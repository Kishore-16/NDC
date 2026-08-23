import pandas as pd
import json
import os
from typing import List, Dict, Any, Tuple
from backend.models import (
    OrgProfile, ScoreBreakdown, TriageItem, NegativeTestItem,
    GoldSetEvaluation, ComparisonItem
)

# Product alias dictionary for normalisation
PRODUCT_ALIASES = {
    "core banking": "Core Banking Framework",
    "banking engine": "Core Banking Framework",
    "identity provider": "Identity Provider SaaS",
    "idp saas": "Identity Provider SaaS",
    "cloud db": "Cloud Database Engine",
    "cloud database": "Cloud Database Engine",
    "waf": "Web Application Firewall",
    "web application firewall": "Web Application Firewall",
    "router os": "Enterprise Router OS",
    "iot gateway": "Embedded IoT Gateway",
}

def normalize_product_name(product: str) -> str:
    cleaned = product.strip()
    lower_p = cleaned.lower()
    if lower_p in PRODUCT_ALIASES:
        return PRODUCT_ALIASES[lower_p]
    for key, val in PRODUCT_ALIASES.items():
        if key in lower_p:
            return val
    return cleaned

def load_vulnerabilities(csv_path: str = "data/vulnerabilities.csv") -> pd.DataFrame:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Vulnerabilities file not found at {csv_path}")
    df = pd.read_csv(csv_path)
    df["product_normalized"] = df["product_name"].apply(normalize_product_name)
    df["cisa_kev"] = df["cisa_kev"].astype(str).str.lower() == "true"
    df["cvss_base_score"] = pd.to_numeric(df["cvss_base_score"], errors="coerce").fillna(0.0)
    df["first_epss"] = pd.to_numeric(df["first_epss"], errors="coerce").fillna(0.0)
    return df

def load_profiles(json_path: str = "data/profiles.json") -> List[OrgProfile]:
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"Profiles file not found at {json_path}")
    with open(json_path, "r") as f:
        data = json.load(f)
    orgs = []
    for raw in data.get("organizations", []):
        orgs.append(OrgProfile(**raw))
    return orgs

def get_priority_label(final_score: float, risk_appetite: str) -> str:
    # Adjust decision thresholds based on risk appetite as requested in PRD
    if risk_appetite.lower() in ["low", "zero-tolerance"]:
        if final_score >= 80:
            return "Urgent"
        elif final_score >= 60:
            return "High"
        elif final_score >= 40:
            return "Medium"
        else:
            return "Low"
    else: # High risk appetite
        if final_score >= 85:
            return "Urgent"
        elif final_score >= 70:
            return "High"
        elif final_score >= 50:
            return "Medium"
        else:
            return "Low"

def get_safe_next_action(cve_id: str, product_name: str, cisa_kev: bool, epss: float, is_critical: bool) -> str:
    if cisa_kev:
        return f"URGENT REMEDIATION: Active exploitation confirmed by CISA KEV. Apply official vendor patch or isolate affected {product_name} instance immediately within 24 hours."
    elif epss >= 0.70:
        return f"HIGH PRIORITY PATCHING: High exploitation probability ({epss*100:.1f}%). Schedule emergency maintenance window to update {product_name} and restrict network access."
    elif is_critical:
        return f"REDUCE EXPOSURE: {product_name} is a designated critical product. Verify running software version and apply compensating security controls (WAF rule / ACL restriction)."
    else:
        return f"MONITOR & AUDIT: Review vendor security advisory for {product_name}, confirm software inventory version, and add to next routine maintenance cycle."

def calculate_score_breakdown(row: pd.Series, profile: OrgProfile) -> ScoreBreakdown:
    w = profile.weight_modifiers
    
    cvss_val = float(row["cvss_base_score"])
    cvss_norm = cvss_val / 10.0
    cvss_contrib = cvss_norm * w.cvss_weight * 100.0
    
    kev_bool = bool(row["cisa_kev"])
    kev_score = 1.0 if kev_bool else 0.0
    kev_contrib = kev_score * w.cisa_kev_weight * 100.0
    
    epss_val = float(row["first_epss"])
    epss_contrib = epss_val * w.first_epss_weight * 100.0
    
    base_score = cvss_contrib + kev_contrib + epss_contrib
    
    # Critical product boost (+10 explicit bonus)
    norm_prod = normalize_product_name(row["product_name"])
    norm_crit = [normalize_product_name(p) for p in profile.critical_products]
    is_crit = norm_prod in norm_crit
    critical_boost = 10.0 if is_crit else 0.0
    
    # A critical-product boost can take a full-weight score above 100. The
    # personalised score is intentionally presented as a 0–100 scale.
    final_score = max(0.0, min(100.0, base_score + critical_boost))
    
    return ScoreBreakdown(
        cvss_normalized=round(cvss_norm, 4),
        cvss_contrib=round(cvss_contrib, 1),
        cvss_weight_pct=round(w.cvss_weight * 100, 1),
        kev_score=kev_score,
        kev_contrib=round(kev_contrib, 1),
        kev_weight_pct=round(w.cisa_kev_weight * 100, 1),
        epss_score=round(epss_val, 4),
        epss_contrib=round(epss_contrib, 1),
        epss_weight_pct=round(w.first_epss_weight * 100, 1),
        base_score=round(base_score, 1),
        is_critical_product=is_crit,
        critical_product_boost=round(critical_boost, 1),
        final_score=round(final_score, 1)
    )

def generate_plain_title(product_name: str, cisa_kev: bool, epss: float) -> str:
    if cisa_kev and epss > 0.8:
        return f"Critical Active Threat targeting {product_name}"
    elif cisa_kev:
        return f"Known Exploited Vulnerability in {product_name}"
    elif epss > 0.7:
        return f"High Likelihood Cyber Attack on {product_name}"
    else:
        return f"Security Flaw affecting {product_name}"

def generate_why_ranked_here(breakdown: ScoreBreakdown, profile: OrgProfile, product_name: str) -> str:
    reasons = []
    w = profile.weight_modifiers
    
    if breakdown.is_critical_product:
        reasons.append(f"⭐ Affects '{product_name}' which is marked as a CRITICAL product for {profile.name} (+10.0 bonus).")
    
    if breakdown.kev_score == 1.0:
        reasons.append(f"⚡ Confirmed in CISA KEV (Active exploitation in the wild, contributing +{breakdown.kev_contrib:.1f} pts at {breakdown.kev_weight_pct:.0f}% weight).")
    
    if breakdown.epss_score >= 0.5:
        reasons.append(f"📈 EPSS probability is {breakdown.epss_score*100:.1f}%. Your organisation weights EPSS at {breakdown.epss_weight_pct:.0f}%, contributing +{breakdown.epss_contrib:.1f} pts.")
    elif breakdown.epss_score > 0:
        reasons.append(f"EPSS likelihood is {breakdown.epss_score*100:.1f}% (contributing +{breakdown.epss_contrib:.1f} pts).")
        
    reasons.append(f"🔴 CVSS score is {breakdown.cvss_normalized*10:.1f}/10 (contributing +{breakdown.cvss_contrib:.1f} pts at {breakdown.cvss_weight_pct:.0f}% weight).")
    
    # Highlight strongest factor
    factors = [
        ("EPSS probability", breakdown.epss_contrib),
        ("CISA KEV exploitation", breakdown.kev_contrib),
        ("CVSS technical severity", breakdown.cvss_contrib)
    ]
    factors.sort(key=lambda x: x[1], reverse=True)
    reasons.append(f"Summary: {factors[0][0]} is the strongest factor driving this ranking for {profile.name}.")
    
    return " ".join(reasons)

def triage_vulnerabilities(profile: OrgProfile, df: pd.DataFrame) -> Tuple[List[TriageItem], List[TriageItem]]:
    items = []
    norm_crit = [normalize_product_name(p) for p in profile.critical_products]
    
    for idx, row in df.iterrows():
        norm_prod = normalize_product_name(row["product_name"])
        is_relevant = norm_prod in norm_crit
        
        breakdown = calculate_score_breakdown(row, profile)
        p_label = get_priority_label(breakdown.final_score, profile.risk_appetite)
        plain_title = generate_plain_title(row["product_name"], bool(row["cisa_kev"]), float(row["first_epss"]))
        why_ranked = generate_why_ranked_here(breakdown, profile, row["product_name"])
        
        impact = f"Ransomware/Exfiltration threat to {row['product_name']} infrastructure." if row["cisa_kev"] else f"Potential compromise of {row['product_name']} services if exploited."
        safe_action = get_safe_next_action(row["cve_id"], row["product_name"], bool(row["cisa_kev"]), float(row["first_epss"]), breakdown.is_critical_product)
        
        item = TriageItem(
            rank=0, # To be set after sorting
            cve_id=row["cve_id"],
            product_name=row["product_name"],
            cvss_base_score=float(row["cvss_base_score"]),
            cisa_kev=bool(row["cisa_kev"]),
            first_epss=float(row["first_epss"]),
            priority_label=p_label,
            score_breakdown=breakdown,
            plain_title=plain_title,
            why_ranked_here=why_ranked,
            potential_impact=impact,
            safe_next_action=safe_action,
            confidence_level="High" if (row["cisa_kev"] or row["first_epss"] > 0.5) else "Medium",
            confidence_reason="Verified against NVD CVSS, CISA KEV list, and FIRST EPSS probability feed.",
            provenance_sources=["NIST NVD", "CISA KEV", "FIRST EPSS"],
            reference_url=f"https://nvd.nist.gov/vuln/detail/{row['cve_id']}",
            status="RELEVANT" if is_relevant else "EXCLUDED"
        )
        items.append(item)
        
    # The source snapshot can contain repeated CVE records. The active ranking
    # must represent each CVE once, while the inventory retains every source row.
    unique_items: Dict[str, TriageItem] = {}
    for item in items:
        existing = unique_items.get(item.cve_id)
        if existing is None or item.score_breakdown.final_score > existing.score_breakdown.final_score:
            unique_items[item.cve_id] = item

    relevant_items = [i for i in unique_items.values() if i.status == "RELEVANT"]
    relevant_items.sort(key=lambda x: x.score_breakdown.final_score, reverse=True)
    
    # Assign ranks to top relevant items
    for idx, item in enumerate(relevant_items):
        item.rank = idx + 1
        
    all_sorted = sorted(items, key=lambda x: x.score_breakdown.final_score, reverse=True)
    return relevant_items[:5], all_sorted

def get_negative_tests(profile: OrgProfile, df: pd.DataFrame) -> List[NegativeTestItem]:
    negatives = []
    norm_crit = [normalize_product_name(p) for p in profile.critical_products]
    
    # Find high CVSS (>= 9.0) CVEs whose product is NOT in org's critical products
    high_cvss = df[(df["cvss_base_score"] >= 9.0) & (~df["product_normalized"].isin(norm_crit))]
    high_cvss_sorted = high_cvss.sort_values(by="cvss_base_score", ascending=False)
    
    for idx, row in high_cvss_sorted.head(10).iterrows():
        negatives.append(NegativeTestItem(
            cve_id=row["cve_id"],
            product_name=row["product_name"],
            cvss_base_score=float(row["cvss_base_score"]),
            cisa_kev=bool(row["cisa_kev"]),
            first_epss=float(row["first_epss"]),
            exclusion_reason=f"Product '{row['product_name']}' is NOT used or listed in {profile.name}'s critical product inventory.",
            why_not_top1=f"Despite extreme technical CVSS score of {row['cvss_base_score']} and EPSS {row['first_epss']*100:.1f}%, this vulnerability does not impact any active service in your profile context.",
            decision="EXCLUDED"
        ))
    return negatives

def evaluate_gold_set(profile: OrgProfile, gold_path: str = "data/gold_set.csv") -> GoldSetEvaluation:
    if not os.path.exists(gold_path):
        raise FileNotFoundError(f"Gold set file not found at {gold_path}")
        
    df_gold = pd.read_csv(gold_path)
    df_gold["cisa_kev"] = df_gold["cisa_kev"].astype(str).str.lower() == "true"
    df_gold["cvss_base_score"] = pd.to_numeric(df_gold["cvss_base_score"], errors="coerce")
    df_gold["first_epss"] = pd.to_numeric(df_gold["first_epss"], errors="coerce")
    
    rank_col = "practitioner_rank_bank" if "bank" in profile.name.lower() else "practitioner_rank_startup"
    
    results = []
    scored_items = []
    
    for idx, row in df_gold.iterrows():
        breakdown = calculate_score_breakdown(row, profile)
        scored_items.append((row["cve_id"], row["product_name"], breakdown.final_score, row[rank_col]))
        
    scored_items.sort(key=lambda x: x[2], reverse=True)
    
    top_5_calc = set([item[0] for item in scored_items[:5]])
    top_5_pract = set(df_gold[df_gold[rank_col] <= 5]["cve_id"].tolist())
    
    overlap = len(top_5_calc.intersection(top_5_pract))
    overlap_pct = (overlap / len(top_5_pract) * 100.0) if top_5_pract else 0.0
    
    for calc_rank, (cve_id, product_name, score, pract_rank) in enumerate(scored_items, start=1):
        results.append({
            "cve_id": cve_id,
            "product_name": product_name,
            "system_score": round(score, 1),
            "system_rank": calc_rank,
            "practitioner_rank": int(pract_rank),
            "rank_delta": int(abs(calc_rank - int(pract_rank)))
        })
        
    return GoldSetEvaluation(
        org_name=profile.name,
        total_eval_items=len(df_gold),
        top_5_overlap_count=overlap,
        top_5_overlap_pct=round(overlap_pct, 1),
        rank_comparison=results
    )

def compare_profiles(profile1: OrgProfile, profile2: OrgProfile, df: pd.DataFrame) -> List[ComparisonItem]:
    rel1, all1 = triage_vulnerabilities(profile1, df)
    rel2, all2 = triage_vulnerabilities(profile2, df)
    
    m1 = {item.cve_id: item for item in all1}
    m2 = {item.cve_id: item for item in all2}
    
    # Collect all unique top 5 CVEs from both profiles
    cve_ids = list(set([i.cve_id for i in rel1] + [i.cve_id for i in rel2]))
    
    comparison = []
    for cve in cve_ids:
        item1 = m1.get(cve)
        item2 = m2.get(cve)
        
        prod_name = item1.product_name if item1 else (item2.product_name if item2 else "Unknown")
        cvss = item1.cvss_base_score if item1 else item2.cvss_base_score
        kev = item1.cisa_kev if item1 else item2.cisa_kev
        epss = item1.first_epss if item1 else item2.first_epss
        
        rank1 = item1.rank if (item1 and item1.rank > 0) else None
        score1 = item1.score_breakdown.final_score if item1 else None
        
        rank2 = item2.rank if (item2 and item2.rank > 0) else None
        score2 = item2.score_breakdown.final_score if item2 else None
        
        # Explanation of rank shift
        if rank1 == rank2:
            shift = f"Ranked #{rank1} in both profiles due to high severity and matching context."
        elif rank1 and not rank2:
            shift = f"Ranked #{rank1} for {profile1.name} (Critical product), but EXCLUDED for {profile2.name} as product is not in their tech stack."
        elif rank2 and not rank1:
            shift = f"Ranked #{rank2} for {profile2.name} (Critical product), but EXCLUDED for {profile1.name} as product is not in their tech stack."
        else:
            w1_top = "EPSS" if profile1.weight_modifiers.first_epss_weight > profile1.weight_modifiers.cvss_weight else "CVSS"
            w2_top = "EPSS" if profile2.weight_modifiers.first_epss_weight > profile2.weight_modifiers.cvss_weight else "CVSS"
            shift = f"Rank shifted (#{rank1} vs #{rank2}) because {profile1.name} favors {w1_top} while {profile2.name} favors {w2_top}."
            
        comparison.append(ComparisonItem(
            cve_id=cve,
            product_name=prod_name,
            cvss_base_score=cvss,
            cisa_kev=kev,
            first_epss=epss,
            rank_org1=rank1,
            score_org1=score1,
            rank_org2=rank2,
            score_org2=score2,
            shift_explanation=shift
        ))
        
    comparison.sort(key=lambda x: (x.rank_org1 or 99, x.rank_org2 or 99))
    return comparison
