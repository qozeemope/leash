import threading
import uuid
from datetime import timedelta
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection, connections
from django.test import TransactionTestCase
from django.utils import timezone

from . import services
from .models import MandateRecord, PayPalOrder
from .policy import CartItem, Mandate, ProposedAction

WORKERS = 6


def fake_create_order(**kwargs):
    return {
        "id": f"PAYPAL-{kwargs['reference_id']}",
        "approve_url": "https://paypal.test/approve",
        "status": "CREATED",
    }


@skipUnless(connection.vendor == "postgresql", "row locking needs PostgreSQL")
class BudgetRaceTests(TransactionTestCase):
    def setUp(self):
        user = get_user_model().objects.create_user("racer", password="a-long-test-password")
        mandate = Mandate(
            mandate_id=str(uuid.uuid4()),
            currency="USD",
            budget_cents=6000,
            expires_at=timezone.now() + timedelta(days=1),
            allowed_categories=("socks",),
            per_item_cap_cents=5000,
        )
        self.record = services.create_signed_mandate(user, "race", mandate)
        item = CartItem(
            title="Socks",
            category="socks",
            unit_price_cents=4000,
            quantity=1,
            merchant="RunCo",
            merchant_rating=4.5,
            delivery_days=2,
        )
        self.action = ProposedAction(kind="checkout", items=(item,))

    def test_parallel_proposals_cannot_exceed_the_budget(self):
        barrier = threading.Barrier(WORKERS)
        outcomes, errors = [], []

        def worker():
            barrier.wait()
            try:
                result = services.submit_proposal(self.record, self.action, {"kind": "checkout"})
                outcomes.append(result["outcome"])
            except Exception as exc:
                errors.append(exc)
            finally:
                connections.close_all()

        with patch("leash.paypal.create_order", side_effect=fake_create_order):
            threads = [threading.Thread(target=worker) for _ in range(WORKERS)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()

        self.assertEqual(errors, [])
        self.assertEqual(outcomes.count("approve"), 1)
        self.assertEqual(outcomes.count("block"), WORKERS - 1)
        self.assertEqual(PayPalOrder.objects.count(), 1)
        self.assertLessEqual(MandateRecord.objects.get(pk=self.record.pk).spent_cents(), 6000)
