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
    get_allowed_frontend_urls, get_fixed_vulnerabilities_collection, get_frontend_url, get_organisation_profiles_collection, get_users_collection,
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


BRIEFING_HEADINGS = ("Why it matters", "Why it is ranked this way", "Recommended next step")
BRIEFING_HEADING_PATTERN = re.compile(
    r"(?im)^\s*(?:#{1,6}\s*)?(Why it matters|Why it is ranked this way|Recommended next step)\s*:?\s*"
)
BRIEFING_META_LANGUAGE = re.compile(
    r"\b(identify the required structure|the prompt says|the instructions (?:say|require)|"
    r"system prompt|provided json|as an ai|i need to|tags;|no markdown)\b",
    re.IGNORECASE,
)


def _strip_reasoning_wrappers(content: str) -> str:
    """Keep only final text when a reasoning model leaks its scratch work."""
    cleaned = re.sub(r"<(?:think|analysis)[^>]*>.*?</(?:think|analysis)>\s*", "", content, flags=re.IGNORECASE | re.DOTALL)
    return cleaned.replace("```text", "").replace("```", "").strip()


def _briefing_sections(content: str) -> Optional[Dict[str, str]]:
    """Return a strict three-part briefing, or None when a provider ignored the format."""
    cleaned = _strip_reasoning_wrappers(content)
    matches = list(BRIEFING_HEADING_PATTERN.finditer(cleaned))
    if len(matches) != len(BRIEFING_HEADINGS):
        return None
    if cleaned[:matches[0].start()].strip():
        return None
    if [match.group(1).casefold() for match in matches] != [heading.casefold() for heading in BRIEFING_HEADINGS]:
        return None

    sections: Dict[str, str] = {}
    for index, match in enumerate(matches):
        heading = match.group(1).casefold()
        body = cleaned[match.end():matches[index + 1].start() if index + 1 < len(matches) else None].strip()
        if not body or heading in sections:
            return None
        sections[heading] = re.sub(r"\s+", " ", body)

    if set(sections) != {heading.casefold() for heading in BRIEFING_HEADINGS}:
        return None
    return sections


def _valid_briefing(content: str, facts: Dict[str, Any]) -> Optional[str]:
    """Accept only concise, final answers that demonstrably describe this CVE."""
    sections = _briefing_sections(content)
    if not sections:
        return None
    combined = " ".join(sections.values())
    if BRIEFING_META_LANGUAGE.search(combined):
        return None
    if str(facts["CVE"]).casefold() not in combined.casefold() or str(facts["product"]).casefold() not in combined.casefold():
        return None
    if any(len(body.split()) > 35 for body in sections.values()):
        return None
    return "\n\n".join(f"{heading}\n{sections[heading.casefold()]}" for heading in BRIEFING_HEADINGS)


def _fact_based_briefing(item: TriageItem, profile: OrgProfile) -> str:
    """Guaranteed safe fallback when an AI provider returns unusable content."""
    breakdown = item.score_breakdown
    criticality = "is marked as a critical product" if breakdown.is_critical_product else "is not marked as a critical product"
    kev = "is listed in CISA KEV" if item.cisa_kev else "is not listed in CISA KEV"
    return (
        f"Why it matters\n{item.cve_id} affects {item.product_name}, which {criticality} for {profile.name}. It {kev}; the supplied facts do not establish affected versions or business impact.\n\n"
        f"Why it is ranked this way\nDeterministic score: {breakdown.final_score:.1f}/100. It combines CVSS {item.cvss_base_score:.1f}, EPSS {item.first_epss * 100:.1f}%, KEV status, and this profile's product relevance.\n\n"
        f"Recommended next step\n{item.safe_next_action}"
    )


def get_ai_explanation(item: TriageItem, profile: OrgProfile, purpose: str = "explanation") -> str:
    """Request a constrained, defensive explanation without exposing provider secrets."""
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    featherless_key = os.getenv("FEATHERLESS_API_KEY", "").strip()
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
            "Return exactly these plain-text headings in this exact order: Why it matters, Why it is ranked this way, "
            "Recommended next step. Put one sentence-case paragraph of at most 35 words beneath each heading. "
            "Name the exact supplied CVE ID and product. In the ranking section, label the deterministic score separately "
            "from the explanation and cite CVSS, EPSS, KEV status, and product relevance. State uncertainty when facts do not establish something."
        )
    logger = logging.getLogger(__name__)

    def payload_for(model: str, corrective: bool = False, supports_reasoning_control: bool = False) -> bytes:
        corrective_instruction = "" if not corrective else (
            " Your previous response was invalid. Return only the three required headings and their short paragraphs; "
            "do not discuss instructions, JSON, formatting, or your reasoning."
        )
        payload = {
            "model": model,
            "max_tokens": 300 if purpose == "explanation" else 420,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": system_prompt + corrective_instruction},
                {"role": "user", "content": "Explain this decision using only these facts:\n" + json.dumps(facts, indent=2)},
            ],
        }
        if supports_reasoning_control:
            payload["reasoning"] = {"enabled": False}
        return json.dumps(payload).encode("utf-8")

    def request_provider(endpoint: str, api_key: str, model: str, extra_headers: Optional[Dict[str, str]] = None, supports_reasoning_control: bool = False, corrective: bool = False) -> str:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        provider_request = urllib.request.Request(endpoint, data=payload_for(model, corrective, supports_reasoning_control), method="POST", headers=headers)
        with urllib.request.urlopen(provider_request, timeout=30) as response:
            provider_response = json.loads(response.read().decode("utf-8"))
        content = provider_response["choices"][0]["message"].get("content") or ""
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        if not isinstance(content, str):
            raise ValueError("The AI provider returned non-text content")
        content = _strip_reasoning_wrappers(content)
        if not content:
            raise ValueError("The AI provider returned an empty explanation")
        return content

    def try_provider(endpoint: str, api_key: str, model: str, extra_headers: Optional[Dict[str, str]] = None, supports_reasoning_control: bool = False) -> Optional[str]:
        for corrective in (False, True):
            try:
                content = request_provider(endpoint, api_key, model, extra_headers, supports_reasoning_control, corrective)
                if purpose == "remediation":
                    return content
                briefing = _valid_briefing(content, facts)
                if briefing:
                    return briefing
                logger.warning("AI provider returned an invalid briefing for %s (corrective=%s)", item.cve_id, corrective)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
                logger.warning("AI provider failed for %s (corrective=%s): %s", item.cve_id, corrective, exc)
        return None

    # OpenRouter is the primary provider. Its Qwen model slug is intentionally
    # configurable because provider model availability can change over time.
    if openrouter_key:
        briefing = try_provider(
            "https://openrouter.ai/api/v1/chat/completions",
            openrouter_key,
            os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free").strip(),
            {"HTTP-Referer": FRONTEND_URL, "X-Title": "NEXORA Triage"},
            supports_reasoning_control=True,
        )
        if briefing:
            return briefing

    if featherless_key:
        briefing = try_provider(
            "https://api.featherless.ai/v1/chat/completions",
            featherless_key,
            os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen3-0.6B").strip(),
        )
        if briefing:
            return briefing

    if purpose == "explanation":
        logger.warning("Using deterministic AI-briefing fallback for %s", item.cve_id)
        return _fact_based_briefing(item, profile)
    raise HTTPException(status_code=502, detail="The AI remediation service is temporarily unavailable. Please try again shortly.")

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
    user = get_current_user(request)
    profile = resolve_profile(profile_id, user)
        
    _, all_inventory = triage_vulnerabilities(profile, VULN_DF)
    fixed_cves = {item["cve_id"] for item in get_fixed_vulnerabilities_collection().find({"owner_user_id": str(user["_id"]), "profile_id": profile.org_id}, {"_id": 0, "cve_id": 1})}
    for item in all_inventory:
        item.is_fixed = item.cve_id in fixed_cves
    top_5 = [item.copy(deep=True) for item in all_inventory if item.status == "RELEVANT" and not item.is_fixed][:5]
    for rank, item in enumerate(top_5, start=1):
        item.rank = rank
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


@app.put("/api/profiles/{profile_id}/vulnerabilities/{cve_id}/fixed")
def mark_vulnerability_fixed(profile_id: str, cve_id: str, request: Request):
    user = get_current_user(request)
    profile = resolve_profile(profile_id, user)
    _, inventory = triage_vulnerabilities(profile, VULN_DF)
    if not any(item.cve_id == cve_id and item.status == "RELEVANT" for item in inventory):
        raise HTTPException(status_code=404, detail="Relevant vulnerability not found for this profile")
    get_fixed_vulnerabilities_collection().update_one(
        {"owner_user_id": str(user["_id"]), "profile_id": profile.org_id, "cve_id": cve_id},
        {"$set": {"updated_at": time.time()}, "$setOnInsert": {"created_at": time.time()}},
        upsert=True,
    )
    return {"detail": "Vulnerability marked fixed", "cve_id": cve_id}


@app.delete("/api/profiles/{profile_id}/vulnerabilities/{cve_id}/fixed")
def reopen_vulnerability(profile_id: str, cve_id: str, request: Request):
    user = get_current_user(request)
    resolve_profile(profile_id, user)
    get_fixed_vulnerabilities_collection().delete_one({"owner_user_id": str(user["_id"]), "profile_id": profile_id, "cve_id": cve_id})
    return {"detail": "Vulnerability reopened", "cve_id": cve_id}


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
