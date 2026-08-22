from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class WeightModifiers(BaseModel):
    cvss_weight: float = Field(..., ge=0.0, le=1.0)
    cisa_kev_weight: float = Field(..., ge=0.0, le=1.0)
    first_epss_weight: float = Field(..., ge=0.0, le=1.0)

class OrgProfile(BaseModel):
    org_id: str
    name: str
    sector: str
    risk_appetite: str
    weight_modifiers: WeightModifiers
    critical_products: List[str]


class CustomProfileInput(BaseModel):
    """Client-supplied organisation context; the server owns the profile ID."""
    name: str
    sector: str
    risk_appetite: str
    weight_modifiers: WeightModifiers
    critical_products: List[str]

class VulnerabilityRecord(BaseModel):
    cve_id: str
    product_name: str
    cvss_base_score: Optional[float] = None
    cisa_kev: bool
    first_epss: float

class ScoreBreakdown(BaseModel):
    cvss_normalized: float
    cvss_contrib: float
    cvss_weight_pct: float
    kev_score: float
    kev_contrib: float
    kev_weight_pct: float
    epss_score: float
    epss_contrib: float
    epss_weight_pct: float
    base_score: float
    is_critical_product: bool
    critical_product_boost: float
    final_score: float

class TriageItem(BaseModel):
    rank: int
    cve_id: str
    product_name: str
    cvss_base_score: float
    cisa_kev: bool
    first_epss: float
    priority_label: str  # Urgent, High, Medium, Low
    score_breakdown: ScoreBreakdown
    plain_title: str
    why_ranked_here: str
    potential_impact: str
    safe_next_action: str
    confidence_level: str  # High, Medium, Low
    confidence_reason: str
    provenance_sources: List[str]
    reference_url: str
    status: str  # RELEVANT, NEEDS_VERIFICATION, EXCLUDED

class NegativeTestItem(BaseModel):
    cve_id: str
    product_name: str
    cvss_base_score: float
    cisa_kev: bool
    first_epss: float
    exclusion_reason: str
    why_not_top1: str
    decision: str  # EXCLUDED

class GoldSetEvaluation(BaseModel):
    org_name: str
    total_eval_items: int
    top_5_overlap_count: int
    top_5_overlap_pct: float
    rank_comparison: List[Dict[str, Any]]

class ComparisonItem(BaseModel):
    cve_id: str
    product_name: str
    cvss_base_score: float
    cisa_kev: bool
    first_epss: float
    rank_org1: Optional[int] = None
    score_org1: Optional[float] = None
    rank_org2: Optional[int] = None
    score_org2: Optional[float] = None
    shift_explanation: str
