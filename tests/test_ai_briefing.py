import unittest

from backend.app import _fact_based_briefing, _valid_briefing
from backend.engine import load_profiles, load_vulnerabilities, triage_vulnerabilities


class TestAiBriefing(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.profile = load_profiles("data/profiles.json")[0]
        _, cls.inventory = triage_vulnerabilities(cls.profile, load_vulnerabilities("data/vulnerabilities.csv"))
        cls.item = cls.inventory[0]
        cls.facts = {"CVE": cls.item.cve_id, "product": cls.item.product_name}

    def test_valid_briefing_requires_cve_specific_evidence(self):
        content = (
            f"Why it matters\n{self.item.cve_id} affects {self.item.product_name}; the supplied facts do not establish affected versions.\n\n"
            f"Why it is ranked this way\nDeterministic score: {self.item.score_breakdown.final_score:.1f}/100. CVSS, EPSS, KEV status, and product relevance determine it.\n\n"
            f"Recommended next step\nReview the recorded action for {self.item.product_name} and document progress for {self.item.cve_id}."
        )
        self.assertEqual(_valid_briefing(content, self.facts), content)

    def test_meta_analysis_is_rejected(self):
        content = (
            f"Why it matters\n{self.item.cve_id} affects {self.item.product_name}.\n\n"
            "Why it is ranked this way\nThe prompt says I should identify the required structure.\n\n"
            f"Recommended next step\nReview {self.item.product_name}."
        )
        self.assertIsNone(_valid_briefing(content, self.facts))

    def test_missing_or_out_of_order_headings_are_rejected(self):
        content = (
            f"Why it is ranked this way\n{self.item.cve_id} affects {self.item.product_name}.\n\n"
            f"Why it matters\n{self.item.product_name} is relevant.\n\n"
            "Recommended next step\nReview the recorded action."
        )
        self.assertIsNone(_valid_briefing(content, self.facts))

    def test_fallback_is_structured_and_specific(self):
        briefing = _fact_based_briefing(self.item, self.profile)
        self.assertIn(self.item.cve_id, briefing)
        self.assertIn(self.item.product_name, briefing)
        self.assertIsNotNone(_valid_briefing(briefing, self.facts))

    def test_fallbacks_differ_for_different_cves(self):
        other = next(candidate for candidate in self.inventory if candidate.cve_id != self.item.cve_id)
        self.assertNotEqual(_fact_based_briefing(self.item, self.profile), _fact_based_briefing(other, self.profile))


if __name__ == "__main__":
    unittest.main()
