from datetime import timedelta
from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import mandate_parser
from .fakes import FakeLLM, text_response, tool_response
from .llm import LLMRejected, LLMUnavailable
from .test_api import ApiTestCase
from .throttles import ParseThrottle

NOW = timezone.now()


def parse(arguments, text="my rules"):
    fake = FakeLLM(tool_response("propose_mandate", arguments))
    with patch("leash.llm.get_client", return_value=fake):
        return mandate_parser.parse_mandate(text, now=NOW), fake


class ParserTests(SimpleTestCase):
    def test_complete_rules_produce_a_ready_mandate(self):
        parsed, _ = parse(
            {"budget_usd": 60, "allowed_categories": ["Socks"], "max_delivery_days": 3, "min_merchant_rating": 4}
        )
        self.assertEqual(parsed.status, "ready")
        self.assertEqual(parsed.terms["budget_cents"], 6000)
        self.assertEqual(parsed.terms["allowed_categories"], ["socks"])
        self.assertEqual(parsed.terms["per_item_cap_cents"], 6000)
        self.assertEqual(parsed.terms["max_delivery_days"], 3)
        self.assertIn("Spend up to $60.00 in total", parsed.summary)
        self.assertTrue(any("per-item" in a for a in parsed.assumptions))

    def test_dollar_amounts_convert_to_exact_cents(self):
        for dollars, cents in ((42.5, 4250), (19.99, 1999), ("60", 6000), (0.1, 10)):
            with self.subTest(dollars=dollars):
                parsed, _ = parse({"budget_usd": dollars, "allowed_categories": ["socks"]})
                self.assertEqual(parsed.terms["budget_cents"], cents)

    def test_missing_budget_asks_a_question_instead_of_guessing(self):
        parsed, _ = parse({"allowed_categories": ["socks"]})
        self.assertEqual(parsed.status, "needs_clarification")
        self.assertIsNone(parsed.terms)
        self.assertEqual(parsed.questions, ["What is the most you want to spend in total?"])

    def test_missing_categories_asks_a_question(self):
        parsed, _ = parse({"budget_usd": 50})
        self.assertEqual(parsed.status, "needs_clarification")
        self.assertEqual(parsed.questions, ["What kinds of items may be bought?"])

    def test_unusable_budgets_are_treated_as_missing(self):
        for value in (0, -5, True, "abc", None):
            with self.subTest(value=value):
                parsed, _ = parse({"budget_usd": value, "allowed_categories": ["socks"]})
                self.assertEqual(parsed.status, "needs_clarification")

    def test_model_questions_are_kept_but_limited_and_cleaned(self):
        parsed, _ = parse({"clarifying_questions": ["a?", 5, "b?", "  ", "c?", "d?"]})
        self.assertEqual(parsed.questions, ["a?", "b?", "c?"])

    def test_item_limit_above_budget_is_lowered_and_explained(self):
        parsed, _ = parse({"budget_usd": 30, "allowed_categories": ["socks"], "per_item_cap_usd": 50})
        self.assertEqual(parsed.terms["per_item_cap_cents"], 3000)
        self.assertTrue(any("lowered" in a for a in parsed.assumptions))

    def test_confirmation_threshold_above_budget_is_ignored_and_explained(self):
        parsed, _ = parse({"budget_usd": 30, "allowed_categories": ["socks"], "escalate_over_usd": 100})
        self.assertIsNone(parsed.terms["escalate_over_cents"])
        self.assertTrue(any("confirmation threshold" in a for a in parsed.assumptions))

    def test_expiry_is_capped_at_thirty_days(self):
        parsed, _ = parse({"budget_usd": 30, "allowed_categories": ["socks"], "expires_in_hours": 99999})
        self.assertEqual(parsed.terms["expires_at"], (NOW + timedelta(hours=720)).isoformat())

    def test_absurd_amounts_are_rejected_not_passed_on(self):
        with self.assertRaises(LLMRejected):
            parse({"budget_usd": 5_000_000, "allowed_categories": ["socks"]})

    def test_a_reply_without_the_tool_call_is_rejected(self):
        fake = FakeLLM(text_response("Sure, I can help with that."))
        with patch("leash.llm.get_client", return_value=fake):
            with self.assertRaises(LLMRejected):
                mandate_parser.parse_mandate("anything", now=NOW)

    def test_request_to_the_model_is_locked_down(self):
        _, fake = parse({"budget_usd": 30, "allowed_categories": ["socks"]}, text="socks under 30")
        call = fake.calls[0]
        self.assertEqual(call["force_tool"], "propose_mandate")
        self.assertEqual([t.name for t in call["tools"]], ["propose_mandate"])
        self.assertEqual(call["messages"][0].text, "socks under 30")
        self.assertIn("US dollars", call["system"])


class ParseApiTests(ApiTestCase):
    ARGUMENTS = {"budget_usd": 60, "allowed_categories": ["socks"], "max_delivery_days": 3}

    def scripted(self, *items):
        return patch("leash.llm.get_client", return_value=FakeLLM(*items))

    def test_parsed_terms_can_be_confirmed_and_saved_unchanged(self):
        with self.scripted(tool_response("propose_mandate", self.ARGUMENTS)):
            parsed = self.client.post("/api/mandates/parse/", {"text": "socks under $60"}, format="json")
        self.assertEqual(parsed.status_code, 200)
        self.assertEqual(parsed.data["status"], "ready")

        saved = self.client.post(
            "/api/mandates/",
            {"raw_text": "socks under $60", "terms": parsed.data["terms"]},
            format="json",
        )
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data["terms"]["budget_cents"], 6000)

    def test_parsing_never_saves_anything(self):
        with self.scripted(tool_response("propose_mandate", self.ARGUMENTS)):
            self.client.post("/api/mandates/parse/", {"text": "socks under $60"}, format="json")
        self.assertEqual(self.client.get("/api/mandates/").data["count"], 0)

    def test_anonymous_visitors_cannot_use_the_model(self):
        fake = FakeLLM()
        with patch("leash.llm.get_client", return_value=fake):
            response = APIClient().post("/api/mandates/parse/", {"text": "socks"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(fake.calls, [])

    def test_blank_or_oversized_text_is_rejected_before_the_model_is_called(self):
        fake = FakeLLM()
        with patch("leash.llm.get_client", return_value=fake):
            blank = self.client.post("/api/mandates/parse/", {"text": ""}, format="json")
            huge = self.client.post("/api/mandates/parse/", {"text": "x" * 1001}, format="json")
        self.assertEqual((blank.status_code, huge.status_code), (400, 400))
        self.assertEqual(fake.calls, [])

    def test_provider_outage_becomes_a_clean_503(self):
        with self.scripted(LLMUnavailable("down")):
            response = self.client.post("/api/mandates/parse/", {"text": "socks"}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["error"]["code"], "ai_unavailable")

    def test_parse_requests_are_rate_limited_per_user(self):
        script = [tool_response("propose_mandate", self.ARGUMENTS)] * 2
        with self.scripted(*script), patch.object(ParseThrottle, "THROTTLE_RATES", {"ai_parse": "2/hour"}):
            statuses = [
                self.client.post("/api/mandates/parse/", {"text": "socks"}, format="json").status_code
                for _ in range(3)
            ]
        self.assertEqual(statuses, [200, 200, 429])
