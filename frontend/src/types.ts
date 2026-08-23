export interface WeightModifiers {
  cvss_weight: number;
  cisa_kev_weight: number;
  first_epss_weight: number;
}

export interface OrgProfile {
  org_id: string;
  name: string;
  sector: string;
  risk_appetite: string;
  weight_modifiers: WeightModifiers;
  critical_products: string[];
}

export interface ScoreBreakdown {
  cvss_normalized: number;
  cvss_contrib: number;
  cvss_weight_pct: number;
  kev_score: number;
  kev_contrib: number;
  kev_weight_pct: number;
  epss_score: number;
  epss_contrib: number;
  epss_weight_pct: number;
  base_score: number;
  is_critical_product: boolean;
  critical_product_boost: number;
  final_score: number;
}

export interface TriageItem {
  rank: number;
  cve_id: string;
  product_name: string;
  cvss_base_score: number;
  cisa_kev: boolean;
  first_epss: number;
  priority_label: string;
  score_breakdown: ScoreBreakdown;
  plain_title: string;
  why_ranked_here: string;
  potential_impact: string;
  safe_next_action: string;
  confidence_level: string;
  confidence_reason: string;
  provenance_sources: string[];
  reference_url: string;
  status: string;
  is_fixed: boolean;
}

export interface NegativeTestItem {
  cve_id: string;
  product_name: string;
  cvss_base_score: number;
  cisa_kev: boolean;
  first_epss: number;
  exclusion_reason: string;
  why_not_top1: string;
  decision: string;
}

export interface GoldSetEvaluation {
  org_name: string;
  total_eval_items: number;
  top_5_overlap_count: number;
  top_5_overlap_pct: number;
  rank_comparison: {
    cve_id: string;
    product_name: string;
    system_score: number;
    system_rank: number;
    practitioner_rank: number;
    rank_delta: number;
  }[];
}

export interface ComparisonItem {
  cve_id: string;
  product_name: string;
  cvss_base_score: number;
  cisa_kev: boolean;
  first_epss: number;
  rank_org1: number | null;
  score_org1: number | null;
  rank_org2: number | null;
  score_org2: number | null;
  shift_explanation: string;
}
