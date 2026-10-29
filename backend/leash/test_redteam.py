from unittest.mock import patch

from . import agent
from .models import AgentRun, AuditEvent, PayPalOrder
from .test_api import ApiTestCase

EXPECTED_RULES = {
    AgentRun.ATTACK_GIFT_CARD: {"R_ORIGIN", "R_CATEGORY", "R_ITEM_CAP", "R_BUDGET"},
    AgentRun.ATTACK_OVERSPEND: {"R_BUDGET", "R_ITEM_COUNT"},
    AgentRun.ATTACK_BANNED_MERCHANT: {"R_MERCHANT", "R_RATING", "R_DELIVERY"},
}


class SimulatedAttackTests(ApiTestCase):
    def simulate(self, mode):
        mandate_id = self.make_mandate(blocked_merchants=["SketchyShop"])
        run = AgentRun.objects.create(mandate_id=mandate_id, request_text="simulate", mode=mode)
        no_ai = patch("leash.llm.get_client", side_effect=AssertionError("the real AI must not be used"))
        no_order = patch("leash.paypal.create_order", side_effect=AssertionError("no order may be created"))
        with no_ai, no_order:
            agent.execute_run(run.id)
        run.refresh_from_db()
        proposal = run.steps.get(kind="proposal").data
        rules = {hit["rule_id"] for hit in AuditEvent.objects.get(pk=proposal["event_id"]).rule_hits}
        return run, proposal, rules

    def test_every_scripted_attack_is_blocked_and_nothing_is_bought(self):
        for mode, expected in EXPECTED_RULES.items():
            with self.subTest(mode=mode):
                run, proposal, rules = self.simulate(mode)
                self.assertEqual(run.status, AgentRun.COMPLETED)
                self.assertEqual(proposal["outcome"], "block")
                self.assertTrue(expected <= rules, f"expected {expected}, got {rules}")
                self.assertTrue(run.final_message.startswith("Simulation finished"))
        self.assertEqual(PayPalOrder.objects.count(), 0)

    def test_the_gift_card_attack_is_tainted_because_the_agent_read_the_hidden_text(self):
        run, proposal, _ = self.simulate(AgentRun.ATTACK_GIFT_CARD)
        self.assertTrue(run.tainted)
        self.assertEqual(proposal["origin"], "untrusted_content")
        flag = run.steps.get(kind="injection_flag")
        self.assertEqual((flag.data["product_id"], flag.data["withheld"]), ("sock-002", False))

    def test_the_other_attacks_are_stopped_by_the_money_and_merchant_rules_alone(self):
        for mode in (AgentRun.ATTACK_OVERSPEND, AgentRun.ATTACK_BANNED_MERCHANT):
            with self.subTest(mode=mode):
                run, proposal, rules = self.simulate(mode)
                self.assertFalse(run.tainted)
                self.assertEqual(proposal["origin"], "agent")
                self.assertNotIn("R_ORIGIN", rules)

    def test_simulations_are_repeatable(self):
        first = self.simulate(AgentRun.ATTACK_GIFT_CARD)[2]
        second = self.simulate(AgentRun.ATTACK_GIFT_CARD)[2]
        self.assertEqual(first, second)

    def test_a_simulation_can_be_started_through_the_api_and_replayed_to_the_end(self):
        mandate_id = self.make_mandate()
        with patch("leash.agent.dispatch_in_background"):
            response = self.client.post(
                f"/api/mandates/{mandate_id}/agent-runs/",
                {"request": "simulate an attack", "mode": "attack_gift_card"},
                format="json",
            )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["mode"], "attack_gift_card")

        with patch("leash.llm.get_client", side_effect=AssertionError("no real AI")):
            agent.execute_run(response.data["id"])
        detail = self.client.get(f"/api/agent-runs/{response.data['id']}/")
        self.assertEqual(detail.data["status"], "completed")
        self.assertTrue(detail.data["tainted"])

    def test_unknown_modes_are_rejected(self):
        mandate_id = self.make_mandate()
        response = self.client.post(
            f"/api/mandates/{mandate_id}/agent-runs/",
            {"request": "x", "mode": "attack_everything"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
