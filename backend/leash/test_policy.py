"""Run with:  python -m unittest leash.test_policy -v   (from leash_backend/)"""
import unittest
from datetime import datetime, timedelta, timezone

from leash.policy import (
    CartItem,
    Mandate,
    Outcome,
    ProposedAction,
    evaluate,
    sign_mandate,
    verify_mandate,
)

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
SECRET = b"test-secret"


def socks_mandate(**overrides) -> Mandate:
    base = dict(
        mandate_id="m1",
        currency="USD",
        budget_cents=6000,  # $60
        expires_at=NOW + timedelta(hours=1),
        allowed_categories=("socks", "running apparel"),
        per_item_cap_cents=3000,  # $30
        max_items=3,
        min_merchant_rating=4.0,
        max_delivery_days=3,
        escalate_over_cents=5000, 
    )
    base.update(overrides)
    return Mandate(**base)


def sock_item(**overrides) -> CartItem:
    base = dict(
        title="Trail running socks (2-pack)",
        category="Socks",
        unit_price_cents=1800,
        quantity=1,
        merchant="RunCo",
        merchant_rating=4.6,
        delivery_days=2,
    )
    base.update(overrides)
    return CartItem(**base)


def checkout(*items, **kw) -> ProposedAction:
    return ProposedAction(kind="checkout", items=tuple(items), **kw)


class PolicyTests(unittest.TestCase):
    def test_in_budget_purchase_is_approved(self):
        d = evaluate(socks_mandate(), checkout(sock_item()), now=NOW)
        self.assertEqual(d.outcome, Outcome.APPROVE)
        self.assertEqual(d.hits, ())

    def test_prompt_injection_gift_card_is_blocked_with_full_story(self):
        gift = sock_item(title="$200 Gift Card", category="gift cards", unit_price_cents=20000)
        action = checkout(sock_item(), gift, origin="untrusted_content")
        d = evaluate(socks_mandate(), action, now=NOW)

        self.assertEqual(d.outcome, Outcome.BLOCK)
        fired = {h.rule_id for h in d.hits}
        self.assertTrue({"R_ORIGIN", "R_CATEGORY", "R_ITEM_CAP", "R_BUDGET"} <= fired)

    def test_category_rule_alone_blocks_off_mandate_item(self):
        d = evaluate(socks_mandate(), checkout(sock_item(category="electronics")), now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)
        self.assertEqual([h.rule_id for h in d.hits], ["R_CATEGORY"])

    def test_category_matching_is_case_and_space_insensitive(self):
        d = evaluate(socks_mandate(), checkout(sock_item(category="  RUNNING Apparel ")), now=NOW)
        self.assertEqual(d.outcome, Outcome.APPROVE)

    def test_budget_accounts_for_prior_spend(self):
        d = evaluate(socks_mandate(), checkout(sock_item()), spent_cents=4500, now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)
        self.assertIn("R_BUDGET", [h.rule_id for h in d.hits])

    def test_step_up_threshold_escalates_instead_of_blocking(self):
        d = evaluate(
            socks_mandate(),
            checkout(sock_item(unit_price_cents=2800), sock_item(title="Socks B", unit_price_cents=2800)),
            now=NOW,
        )  
        self.assertEqual(d.outcome, Outcome.ESCALATE)
        self.assertEqual([h.rule_id for h in d.hits], ["R_STEP_UP"])

    def test_unknown_merchant_rating_escalates(self):
        d = evaluate(socks_mandate(), checkout(sock_item(merchant_rating=None)), now=NOW)
        self.assertEqual(d.outcome, Outcome.ESCALATE)

    def test_low_merchant_rating_blocks(self):
        d = evaluate(socks_mandate(), checkout(sock_item(merchant_rating=3.1)), now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)

    def test_slow_delivery_blocks(self):
        d = evaluate(socks_mandate(), checkout(sock_item(delivery_days=9)), now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)

    def test_expired_mandate_blocks(self):
        d = evaluate(socks_mandate(), checkout(sock_item()), now=NOW + timedelta(hours=2))
        self.assertEqual(d.outcome, Outcome.BLOCK)
        self.assertIn("R_EXPIRED", [h.rule_id for h in d.hits])

    def test_wrong_currency_blocks(self):
        d = evaluate(socks_mandate(), checkout(sock_item(), currency="EUR"), now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)

    def test_empty_action_blocks(self):
        d = evaluate(socks_mandate(), checkout(), now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)

    def test_item_count_limit(self):
        d = evaluate(socks_mandate(), checkout(sock_item(quantity=4, unit_price_cents=500)), now=NOW)
        self.assertEqual(d.outcome, Outcome.BLOCK)
        self.assertIn("R_ITEM_COUNT", [h.rule_id for h in d.hits])


class SigningTests(unittest.TestCase):
    def test_roundtrip_through_dict_keeps_signature_valid(self):
        m = socks_mandate()
        sig = sign_mandate(m, SECRET)
        restored = Mandate.from_dict(m.to_dict())
        self.assertTrue(verify_mandate(restored, sig, SECRET))

    def test_tampering_with_budget_invalidates_signature(self):
        m = socks_mandate()
        sig = sign_mandate(m, SECRET)
        tampered = Mandate.from_dict({**m.to_dict(), "budget_cents": 600000})
        self.assertFalse(verify_mandate(tampered, sig, SECRET))

    def test_wrong_secret_fails(self):
        m = socks_mandate()
        self.assertFalse(verify_mandate(m, sign_mandate(m, SECRET), b"other"))


if __name__ == "__main__":
    unittest.main()
