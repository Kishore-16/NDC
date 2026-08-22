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
    get_users_collection, google_authorization_url, hash_password, verify_token,
)

from backend.models import (
    OrgProfile, TriageItem, NegativeTestItem, GoldSetEvaluation,
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

# Enable CORS for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173"],
    # Vite chooses the next free port (for example 5174) when 5173 is occupied.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache loaded dataset and built-in profiles
VULN_DF = load_vulnerabilities("data/vulnerabilities.csv")
BUILTIN_PROFILES = {p.org_id: p for p in load_profiles("data/profiles.json")}
CUSTOM_PROFILES: Dict[str, OrgProfile] = {}

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
def google_login():
    try:
        return RedirectResponse(google_authorization_url())
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.get("/api/auth/google/callback")
def google_callback(code: str, state: str):
    try:
        profile = exchange_google_code(code, state)
        users = get_users_collection()
        user = users.find_one_and_update(
            {"email": profile["email"].lower()},
            {"$set": {"name": profile.get("name", profile["email"]), "picture": profile.get("picture", ""), "provider": "google", "updated_at": time.time()}, "$setOnInsert": {"created_at": time.time()}},
            upsert=True, return_document=True,
        )
        if user is None:
            user = users.find_one({"email": profile["email"].lower()})
        token = create_token(user)
        return RedirectResponse(f"{FRONTEND_URL}/?auth_token={urllib.parse.quote(token)}")
    except Exception as exc:
        return RedirectResponse(f"{FRONTEND_URL}/?auth_error={urllib.parse.quote(str(exc))}")

@app.get("/api/auth/me")
def auth_me(request: Request):
    return {"user": user_response(get_current_user(request))}

def resolve_profile(profile_data: Any) -> OrgProfile:
    if isinstance(profile_data, str):
        if profile_data in BUILTIN_PROFILES:
            return BUILTIN_PROFILES[profile_data]
        elif profile_data in CUSTOM_PROFILES:
            return CUSTOM_PROFILES[profile_data]
        else:
            raise HTTPException(status_code=404, detail=f"Profile ID '{profile_data}' not found.")
    elif isinstance(profile_data, dict):
        try:
            return OrgProfile(**profile_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid profile schema: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Invalid profile payload format.")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "total_vulnerabilities": len(VULN_DF), "profiles_count": len(BUILTIN_PROFILES) + len(CUSTOM_PROFILES)}

@app.get("/api/profiles", response_model=List[OrgProfile])
def get_all_profiles():
    all_p = list(BUILTIN_PROFILES.values()) + list(CUSTOM_PROFILES.values())
    return all_p

@app.get("/api/custom-profile-ids", response_model=List[str])
def get_custom_profile_ids():
    """Expose only identifiers so the UI can distinguish removable profiles."""
    return list(CUSTOM_PROFILES.keys())

@app.post("/api/triage")
def run_triage(payload: Dict[str, Any] = Body(...)):
    profile_input = payload.get("profile") or payload.get("profile_id")
    if not profile_input:
        # Default to Agile Cloud Tech Startup (ORG-002)
        profile = BUILTIN_PROFILES.get("ORG-002", list(BUILTIN_PROFILES.values())[0])
    else:
        profile = resolve_profile(profile_input)
        
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
def compare_orgs(payload: Dict[str, Any] = Body(...)):
    p1_input = payload.get("profile_1") or payload.get("org_id_1") or "ORG-001"
    p2_input = payload.get("profile_2") or payload.get("org_id_2") or "ORG-002"
    
    p1 = resolve_profile(p1_input)
    p2 = resolve_profile(p2_input)
    
    comparison = compare_profiles(p1, p2, VULN_DF)
    return {
        "profile_1": p1,
        "profile_2": p2,
        "comparison": comparison
    }

@app.get("/api/negative-test/{profile_id}")
def get_negative_test_for_profile(profile_id: str):
    profile = resolve_profile(profile_id)
    negatives = get_negative_tests(profile, VULN_DF)
    return {"profile": profile, "negative_tests": negatives}

@app.get("/api/gold-set-eval/{profile_id}")
def get_gold_set_eval_for_profile(profile_id: str):
    profile = resolve_profile(profile_id)
    eval_res = evaluate_gold_set(profile, "data/gold_set.csv")
    return {"profile": profile, "evaluation": eval_res}

@app.post("/api/upload-profile", response_model=OrgProfile)
def upload_profile(profile: OrgProfile):
    CUSTOM_PROFILES[profile.org_id] = profile
    return profile

@app.delete("/api/profiles/{profile_id}")
def delete_custom_profile(profile_id: str):
    if profile_id in BUILTIN_PROFILES:
        raise HTTPException(status_code=403, detail="Built-in demo profiles cannot be deleted")
    if profile_id not in CUSTOM_PROFILES:
        raise HTTPException(status_code=404, detail="Custom profile not found")
    del CUSTOM_PROFILES[profile_id]
    return {"detail": "Custom profile deleted"}
