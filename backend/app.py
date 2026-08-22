import logging
from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from typing import List, Optional, Dict, Any
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from backend.auth import (
    FRONTEND_URL, check_password, create_token, exchange_google_code,
    get_allowed_frontend_urls, get_frontend_url, get_organisation_profiles_collection, get_users_collection,
    google_authorization_url, hash_password, verify_token,
)


from backend.models import (
    CustomProfileInput, OrgProfile, TriageItem, NegativeTestItem, GoldSetEvaluation,
    ComparisonItem
)
from backend.engine import (
    load_vulnerabilities, load_profiles, triage_vulnerabilities,
    get_negative_tests, evaluate_gold_set, compare_profiles
)

app = FastAPI(
    title="Personalised Vulnerability Triage Platform",
    version="2.0",
    description="Deterministic vulnerability decision engine & triage platform"
)

# Enable CORS for Vite frontend (local and deployed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_frontend_urls(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Cache loaded dataset and built-in profiles
VULN_DF = load_vulnerabilities("data/vulnerabilities.csv")
BUILTIN_PROFILES = {p.org_id: p for p in load_profiles("data/profiles.json")}

def user_response(user: Dict[str, Any]) -> Dict[str, str]:
    return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name", "")}


def auth_service_error(exc: Exception) -> HTTPException:
    """Return a useful, non-secret diagnostic when MongoDB is unavailable."""
    message = str(exc)
    if "MONGODB_URI" in message or "pymongo is required" in message:
        detail = message
    else:
        detail = (
            "Cannot connect to MongoDB. Verify the Atlas URI and database-user password, "
            "then add your current IP address to Atlas Network Access."
        )
    return HTTPException(status_code=503, detail=detail)

def get_current_user(request: Request) -> Dict[str, Any]:
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required")
    try:
        claims = verify_token(authorization[7:])
        users = get_users_collection()
        from bson import ObjectId
        user = users.find_one({"_id": ObjectId(claims["sub"])})
        if not user:
            raise ValueError("User not found")
        return user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session") from exc

@app.post("/api/auth/register")
def register(payload: Dict[str, str] = Body(...)):
    name, email, password = payload.get("name", "").strip(), payload.get("email", "").strip().lower(), payload.get("password", "")
    if not name or not email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Name, a valid email, and an 8-character password are required")
    try:
        users = get_users_collection()
        if users.find_one({"email": email}):
            raise HTTPException(status_code=409, detail="An account already exists for this email")
        user = {"name": name, "email": email, "password_hash": hash_password(password), "provider": "password", "created_at": time.time()}
        user["_id"] = users.insert_one(user).inserted_id
        return {"token": create_token(user), "user": user_response(user)}
    except HTTPException:
        raise
    except Exception as exc:
        raise auth_service_error(exc) from exc

@app.post("/api/auth/login")
def login(payload: Dict[str, str] = Body(...)):
    email, password = payload.get("email", "").strip().lower(), payload.get("password", "")
    try:
        users = get_users_collection()
        user = users.find_one({"email": email})
        if not user or not user.get("password_hash") or not check_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        return {"token": create_token(user), "user": user_response(user)}
    except HTTPException:
        raise
    except Exception as exc:
        raise auth_service_error(exc) from exc

@app.get("/api/auth/google")
def google_login(request: Request, redirect_to: Optional[str] = None):
    try:
        target_frontend = redirect_to or request.headers.get("referer") or request.headers.get("origin")
        if target_frontend and "accounts.google.com" in target_frontend:
            target_frontend = None
        effective_url = get_frontend_url(target_frontend)
        return RedirectResponse(google_authorization_url(effective_url))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.get("/api/auth/google/callback")
def google_callback(code: str, state: str):
    try:
        profile, stored_frontend_url = exchange_google_code(code, state)
        effective_url = get_frontend_url(stored_frontend_url)
        users = get_users_collection()
        user = users.find_one_and_update(
            {"email": profile["email"].lower()},
            {"$set": {"name": profile.get("name", profile["email"]), "picture": profile.get("picture", ""), "provider": "google", "updated_at": time.time()}, "$setOnInsert": {"created_at": time.time()}},
            upsert=True, return_document=True,
        )
        if user is None:
            user = users.find_one({"email": profile["email"].lower()})
        token = create_token(user)
        return RedirectResponse(f"{effective_url}/?auth_token={urllib.parse.quote(token)}")
    except Exception as exc:
        effective_url = get_frontend_url()
        return RedirectResponse(f"{effective_url}/?auth_error={urllib.parse.quote(str(exc))}")



@app.get("/api/auth/me")
def auth_me(request: Request):
    return {"user": user_response(get_current_user(request))}

def resolve_profile(profile_id: str, user: Dict[str, Any]) -> OrgProfile:
    """Return a shared demo profile or a custom profile owned by this user only."""
    if profile_id in BUILTIN_PROFILES:
        return BUILTIN_PROFILES[profile_id]
    profile_document = get_organisation_profiles_collection().find_one({
        "owner_user_id": str(user["_id"]), "profile.org_id": profile_id,
    })
    if not profile_document:
        # Do not disclose whether another account owns this profile.
        raise HTTPException(status_code=404, detail="Profile not found")
    return OrgProfile(**profile_document["profile"])


def get_ai_explanation(item: TriageItem, profile: OrgProfile, purpose: str = "explanation") -> str:
    """Request a constrained, defensive explanation without exposing provider secrets."""
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    featherless_key = os.getenv("FEATHERLESS_API_KEY", "").strip()
    if not openrouter_key and not featherless_key:
        raise HTTPException(
            status_code=503,
            detail="AI explanations are not configured. Set OPENROUTER_API_KEY on the API server.",
        )

    facts = {
        "CVE": item.cve_id,
        "product": item.product_name,
        "organisation": profile.name,
        "risk_appetite": profile.risk_appetite,
        "personalised_rank": item.rank if item.rank else "not in Top 5",
        "personalised_score_out_of_100": item.score_breakdown.final_score,
        "CVSS": item.cvss_base_score,
        "EPSS_probability_percent": round(item.first_epss * 100, 1),
        "in_CISA_KEV": item.cisa_kev,
        "is_critical_product": item.score_breakdown.is_critical_product,
        "deterministic_reason": item.why_ranked_here,
        "safe_next_action": item.safe_next_action,
        "provenance": item.provenance_sources,
        "confidence": f"{item.confidence_level}: {item.confidence_reason}",
    }
    if purpose == "remediation":
        system_prompt = (
            "You create safe, defensive remediation runbooks for a security dashboard. Use ONLY the supplied facts, "
            "especially the safe_next_action. Do not invent product versions, commands, exploit details, bypasses, "
            "threat actors, patches, timelines, or sources. Do not provide offensive or exploit instructions. "
            "Return exactly 4 concise, sentence-case steps, one per line, formatted 'Step N: action'. "
            "Keep each step under 22 words and make it a safe operational action such as verify scope, coordinate, "
            "apply the approved vendor remediation, validate, or document."
        )
    else:
        system_prompt = (
            "You explain vulnerability triage decisions for a defensive security dashboard. "
            "Use ONLY the supplied facts. Do not invent affected versions, exploit steps, patches, "
            "timelines, threat actors, business facts, or sources. Do not provide exploit instructions. "
            "Do not reveal private reasoning or use <think> tags; provide only the final explanation. "
            "Clearly distinguish the deterministic score from your explanation. Use sentence case, no Markdown, "
            "and no more than one short paragraph (35 words) per heading. Use these plain-text headings: Why it matters, "
            "Why it is ranked this way, and Recommended next step. State uncertainty when the supplied facts do not establish something."
        )
    logger = logging.getLogger(__name__)

    def payload_for(model: str) -> bytes:
        payload = {
            "model": model,
            "max_tokens": 420,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Explain this decision using only these facts:\n" + json.dumps(facts, indent=2)},
            ],
        }
        return json.dumps(payload).encode("utf-8")

    def request_provider(endpoint: str, api_key: str, model: str, extra_headers: Optional[Dict[str, str]] = None) -> str:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        provider_request = urllib.request.Request(endpoint, data=payload_for(model), method="POST", headers=headers)
        with urllib.request.urlopen(provider_request, timeout=30) as response:
            provider_response = json.loads(response.read().decode("utf-8"))
        content = (provider_response["choices"][0]["message"].get("content") or "").strip()
        content = re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL).strip()
        if not content:
            raise ValueError("The AI provider returned an empty explanation")
        return content

    # OpenRouter is the primary provider. Its Qwen model slug is intentionally
    # configurable because provider model availability can change over time.
    if openrouter_key:
        try:
            return request_provider(
                "https://openrouter.ai/api/v1/chat/completions",
                openrouter_key,
                os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free").strip(),
                {"HTTP-Referer": FRONTEND_URL, "X-Title": "NEXORA Triage"},
            )
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("OpenRouter failed: %s", exc)
            # Continue to the independent provider only when it was configured.

    if featherless_key:
        try:
            return request_provider(
                "https://api.featherless.ai/v1/chat/completions",
                featherless_key,
                os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen3-0.6B").strip(),
            )
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
            logger.error("Featherless failed: %s", exc)
            raise HTTPException(status_code=502, detail="The AI explanation service is temporarily unavailable. Please try again shortly.") from exc

    raise HTTPException(status_code=502, detail="OpenRouter could not generate an explanation and no Featherless fallback is configured.")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "total_vulnerabilities": len(VULN_DF), "profiles_count": len(BUILTIN_PROFILES)}

@app.get("/api/profiles")
def get_all_profiles(request: Request):
    user = get_current_user(request)
    custom_profiles = list(get_organisation_profiles_collection().find(
        {"owner_user_id": str(user["_id"])}, {"_id": 0, "profile": 1}
    ))
    return {
        "profiles": list(BUILTIN_PROFILES.values()) + [item["profile"] for item in custom_profiles],
        "custom_profile_ids": [item["profile"]["org_id"] for item in custom_profiles],
    }

@app.post("/api/triage")
def run_triage(request: Request, payload: Dict[str, Any] = Body(...)):
    profile_id = payload.get("profile_id")
    if not isinstance(profile_id, str) or not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")
    profile = resolve_profile(profile_id, get_current_user(request))
        
    top_5, all_inventory = triage_vulnerabilities(profile, VULN_DF)
    negatives = get_negative_tests(profile, VULN_DF)
    gold_eval = evaluate_gold_set(profile, "data/gold_set.csv")
    
    return {
        "profile": profile,
        "top_5": top_5,
        "negative_tests": negatives[:5],
        "gold_set_eval": gold_eval,
        "total_inventory_count": len(all_inventory),
        "inventory": all_inventory
    }


@app.post("/api/triage/{cve_id}/ai-explanation")
def explain_triage_decision(cve_id: str, request: Request, payload: Dict[str, Any] = Body(...)):
    """Generate an authenticated, profile-scoped AI explanation for one computed CVE decision."""
    profile_id = payload.get("profile_id")
    if not isinstance(profile_id, str) or not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")
    profile = resolve_profile(profile_id, get_current_user(request))
    _, inventory = triage_vulnerabilities(profile, VULN_DF)
    item = next((candidate for candidate in inventory if candidate.cve_id == cve_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Vulnerability not found for this profile")
    return {
        "cve_id": item.cve_id,
        "profile_id": profile.org_id,
        "explanation": get_ai_explanation(item, profile),
    }


@app.post("/api/triage/{cve_id}/remediation-plan")
def create_remediation_plan(cve_id: str, request: Request, payload: Dict[str, Any] = Body(...)):
    """Generate a profile-scoped, defensive sequence for the already selected safe action."""
    profile_id = payload.get("profile_id")
    if not isinstance(profile_id, str) or not profile_id:
        raise HTTPException(status_code=400, detail="profile_id is required")
    profile = resolve_profile(profile_id, get_current_user(request))
    _, inventory = triage_vulnerabilities(profile, VULN_DF)
    item = next((candidate for candidate in inventory if candidate.cve_id == cve_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Vulnerability not found for this profile")
    return {
        "cve_id": item.cve_id,
        "profile_id": profile.org_id,
        "plan": get_ai_explanation(item, profile, purpose="remediation"),
    }

@app.post("/api/compare")
def compare_orgs(request: Request, payload: Dict[str, Any] = Body(...)):
    user = get_current_user(request)
    p1_input = payload.get("profile_1") or payload.get("org_id_1") or "ORG-001"
    p2_input = payload.get("profile_2") or payload.get("org_id_2") or "ORG-002"
    p1 = resolve_profile(p1_input, user)
    p2 = resolve_profile(p2_input, user)
    
    comparison = compare_profiles(p1, p2, VULN_DF)
    return {
        "profile_1": p1,
        "profile_2": p2,
        "comparison": comparison
    }

@app.get("/api/negative-test/{profile_id}")
def get_negative_test_for_profile(profile_id: str, request: Request):
    profile = resolve_profile(profile_id, get_current_user(request))
    negatives = get_negative_tests(profile, VULN_DF)
    return {"profile": profile, "negative_tests": negatives}

@app.get("/api/gold-set-eval/{profile_id}")
def get_gold_set_eval_for_profile(profile_id: str, request: Request):
    profile = resolve_profile(profile_id, get_current_user(request))
    eval_res = evaluate_gold_set(profile, "data/gold_set.csv")
    return {"profile": profile, "evaluation": eval_res}

def create_owned_profile(profile: CustomProfileInput, request: Request) -> OrgProfile:
    user = get_current_user(request)
    from bson import ObjectId
    profile_id = f"CUST-{ObjectId()}"
    profile_data = {"org_id": profile_id, **profile.dict()}
    get_organisation_profiles_collection().insert_one({
        "owner_user_id": str(user["_id"]), "profile": profile_data,
        "created_at": time.time(), "updated_at": time.time(),
    })
    return OrgProfile(**profile_data)

@app.post("/api/profiles", response_model=OrgProfile)
def create_profile(profile: CustomProfileInput, request: Request):
    return create_owned_profile(profile, request)

@app.post("/api/upload-profile", response_model=OrgProfile, include_in_schema=False)
def upload_profile_compatibility(profile: CustomProfileInput, request: Request):
    return create_owned_profile(profile, request)

@app.delete("/api/profiles/{profile_id}")
def delete_custom_profile(profile_id: str, request: Request):
    user = get_current_user(request)
    if profile_id in BUILTIN_PROFILES:
        raise HTTPException(status_code=403, detail="Built-in demo profiles cannot be deleted")
    result = get_organisation_profiles_collection().delete_one({
        "owner_user_id": str(user["_id"]), "profile.org_id": profile_id,
    })
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Custom profile not found")
    return {"detail": "Custom profile deleted"}
