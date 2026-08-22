from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from typing import List, Optional, Dict, Any
import json
import os
import time
import urllib.parse

from backend.auth import (
    FRONTEND_URL, check_password, create_token, exchange_google_code,
    get_frontend_url, get_organisation_profiles_collection, get_users_collection,
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
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_origin_regex=r"^https?://.*$",
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
