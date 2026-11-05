from datetime import datetime, timedelta, timezone

from django.test import SimpleTestCase

try:
    from .. import agent, attack_sim
    from ..policy import Mandate
    from ..products import SeededSearch
    from ..seed_catalog import CATALOG
except ImportError:
    from . import agent, attack_sim
    from .policy import Mandate
    from .products import SeededSearch
    from .seed_catalog import CATALOG


class FakeRecord:
    def __init__(self, categories, budget_cents=6000, per_item_cap_cents=6000, spent_cents=0):
        self.terms = {
            "mandate_id": "test-mandate",
            "currency": "USD",
            "budget_cents": budget_cents,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
            "allowed_categories": categories,
            "per_item_cap_cents": per_item_cap_cents,
            "max_items": 5,
            "min_merchant_rating": 0.0,
            "max_delivery_days": None,
            "escalate_over_cents": None,
            "blocked_merchants": [],
        }
        self._spent = spent_cents

    def to_policy(self):
        return Mandate.from_dict(self.terms)

    def spent_cents(self):
        return self._spent


def tool_calls(script):
    return [call for response in script for call in response.tool_calls]


class PurchaseScriptTests(SimpleTestCase):
    def setUp(self):
        self.search = SeededSearch(CATALOG)

    def test_picks_the_best_rated_product_that_fits(self):
        script = attack_sim.purchase_script(FakeRecord(["socks"]), self.search, 6)
        calls = tool_calls(script)
        self.assertEqual([c.name for c in calls], ["search_products", "propose_checkout"])
        self.assertEqual(calls[1].arguments["items"][0]["product_id"], "sock-004")

    def test_never_picks_a_listing_with_hidden_instructions(self):
        script = attack_sim.purchase_script(FakeRecord(["socks"], per_item_cap_cents=2300), self.search, 6)
        bought = [item["product_id"] for call in tool_calls(script) for item in call.arguments.get("items", [])]
        self.assertNotIn("sock-002", bought)

    def test_respects_the_item_cap(self):
        script = attack_sim.purchase_script(FakeRecord(["socks"], per_item_cap_cents=1600), self.search, 6)
        bought = [item["product_id"] for call in tool_calls(script) for item in call.arguments.get("items", [])]
        self.assertEqual(bought, ["sock-003"])

    def test_explains_when_nothing_fits(self):
        script = attack_sim.purchase_script(FakeRecord(["jerseys"]), self.search, 6)
        self.assertEqual(len(script), 1)
        self.assertEqual(script[0].tool_calls, ())
        self.assertIn("no product in the demo catalog", script[0].text)

    def test_stops_when_the_budget_is_already_used(self):
        script = attack_sim.purchase_script(FakeRecord(["socks"], spent_cents=5900), self.search, 6)
        self.assertEqual(tool_calls(script), [])


class QueryHelperTests(SimpleTestCase):
    def test_clean_queries_removes_duplicates_and_limits_length(self):
        cleaned = agent.clean_queries(["socks", " socks ", "", 5, "running socks", "a", "b", "c"])
        self.assertEqual(cleaned, ["socks", "running socks", "a", "b"])

    def test_clean_queries_ignores_non_lists(self):
        self.assertEqual(agent.clean_queries("socks"), [])

    def test_fallback_queries_use_the_request_then_the_categories(self):
        mandate = FakeRecord(["jerseys", "soccer uniforms"]).to_policy()
        queries = agent.fallback_queries("arsenal home jersey", mandate)
        self.assertEqual(queries, ["arsenal home jersey", "jerseys", "soccer uniforms"])
