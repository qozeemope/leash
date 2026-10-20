from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .models import MandateRecord, PayPalOrder
from .policy import Mandate


class SpentCentsTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user("buyer", password="a-long-test-password")
        mandate = Mandate(
            mandate_id="m1",
            currency="USD",
            budget_cents=6000,
            expires_at=timezone.now() + timedelta(days=1),
            allowed_categories=("socks",),
            per_item_cap_cents=3000,
        )
        self.record = MandateRecord.objects.create(
            owner=user, raw_text="socks", terms=mandate.to_dict(), signature="unsigned"
        )

    def order(self, paypal_id, cents, status):
        return PayPalOrder.objects.create(
            mandate=self.record,
            paypal_order_id=paypal_id,
            amount_cents=cents,
            currency="USD",
            status=status,
        )

    def test_no_orders_means_nothing_spent(self):
        self.assertEqual(self.record.spent_cents(), 0)

    def test_counts_created_and_completed_but_not_failed(self):
        self.order("A", 1000, PayPalOrder.CREATED)
        self.order("B", 2000, PayPalOrder.COMPLETED)
        self.order("C", 500, PayPalOrder.FAILED)
        self.assertEqual(self.record.spent_cents(), 3000)

    def test_zero_amount_is_rejected_by_the_database(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.order("D", 0, PayPalOrder.CREATED)

    def test_policy_roundtrip_from_stored_terms(self):
        self.assertEqual(self.record.to_policy().budget_cents, 6000)
