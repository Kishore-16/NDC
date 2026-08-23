import sys
import os
import unittest

# Add root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.engine import (
    load_vulnerabilities, load_profiles, triage_vulnerabilities,
    get_negative_tests, evaluate_gold_set, compare_profiles,
    normalize_product_name, calculate_score_breakdown
)

class TestEngine(unittest.TestCase):
    
    def setUp(self):
        self.df_vuln = load_vulnerabilities("data/vulnerabilities.csv")
        self.profiles = load_profiles("data/profiles.json")
        self.bank_profile = self.profiles[0]
        self.startup_profile = self.profiles[1]
        self.utility_profile = self.profiles[2]
        
    def test_data_loading(self):
        self.assertEqual(len(self.df_vuln), 540)
        self.assertEqual(len(self.profiles), 3)
        self.assertEqual(self.bank_profile.name, "Global Retail Bank")
        
    def test_product_normalisation(self):
        self.assertEqual(normalize_product_name("cloud db"), "Cloud Database Engine")
        self.assertEqual(normalize_product_name("WAF"), "Web Application Firewall")
        
    def test_triage_top_5(self):
        top_5, all_items = triage_vulnerabilities(self.startup_profile, self.df_vuln)
        self.assertEqual(len(top_5), 5)
        # Check ranks
        ranks = [item.rank for item in top_5]
        self.assertEqual(ranks, [1, 2, 3, 4, 5])
        # Verify startup critical products match
        for item in top_5:
            self.assertIn(item.product_name, self.startup_profile.critical_products)
            self.assertTrue(item.score_breakdown.is_critical_product)
            self.assertEqual(item.score_breakdown.critical_product_boost, 10.0)
            
    def test_negative_tests(self):
        negatives = get_negative_tests(self.startup_profile, self.df_vuln)
        self.assertGreater(len(negatives), 0)
        for item in negatives:
            self.assertGreaterEqual(item.cvss_base_score, 9.0)
            self.assertNotIn(item.product_name, self.startup_profile.critical_products)
            self.assertEqual(item.decision, "EXCLUDED")
            
    def test_gold_set_evaluation(self):
        eval_result = evaluate_gold_set(self.bank_profile, "data/gold_set.csv")
        self.assertEqual(eval_result.total_eval_items, 5)
        self.assertGreaterEqual(eval_result.top_5_overlap_count, 1)
        
    def test_profile_comparison(self):
        comp = compare_profiles(self.bank_profile, self.startup_profile, self.df_vuln)
        self.assertGreater(len(comp), 0)

    def test_personalised_score_is_capped_at_100(self):
        # Maximum weighted signals plus the critical-product boost must still
        # remain on the public 0–100 score scale.
        row = {
            "product_name": "Core Banking Framework",
            "cvss_base_score": 10.0,
            "cisa_kev": True,
            "first_epss": 1.0,
        }
        breakdown = calculate_score_breakdown(row, self.bank_profile)
        self.assertEqual(breakdown.base_score, 100.0)
        self.assertEqual(breakdown.critical_product_boost, 10.0)
        self.assertEqual(breakdown.final_score, 100.0)

if __name__ == "__main__":
    unittest.main()
