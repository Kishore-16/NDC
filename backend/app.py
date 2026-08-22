from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import json

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache loaded dataset and built-in profiles
VULN_DF = load_vulnerabilities("data/vulnerabilities.csv")
BUILTIN_PROFILES = {p.org_id: p for p in load_profiles("data/profiles.json")}
CUSTOM_PROFILES: Dict[str, OrgProfile] = {}

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
