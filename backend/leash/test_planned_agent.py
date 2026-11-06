from datetime import datetime, timedelta, timezone

from django.test import SimpleTestCase

try:
    from .. import agent
    from ..policy import Mandate
except ImportError:
    from . import agent
    from .policy import Mandate


def make_mandate(categories):
    return Mandate.from_dict(
        {
            "mandate_id": "test-mandate",
            "currency": "USD",
            "budget_cents": 6000,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
            "allowed_categories": categories,
            "per_item_cap_cents": 6000,
        }
    )


class QueryHelperTests(SimpleTestCase):
    def test_clean_queries_removes_duplicates_and_limits_length(self):
        cleaned = agent.clean_queries(["socks", " socks ", "", 5, "running socks", "a", "b", "c"])
        self.assertEqual(cleaned, ["socks", "running socks", "a", "b"])

    def test_clean_queries_ignores_non_lists(self):
        self.assertEqual(agent.clean_queries("socks"), [])

    def test_fallback_queries_use_the_request_then_the_categories(self):
        queries = agent.fallback_queries("arsenal home jersey", make_mandate(["jerseys", "soccer uniforms"]))
        self.assertEqual(queries, ["arsenal home jersey", "jerseys", "soccer uniforms"])

    def test_fallback_queries_skip_an_empty_request(self):
        self.assertEqual(agent.fallback_queries("  ", make_mandate(["socks"])), ["socks"])
