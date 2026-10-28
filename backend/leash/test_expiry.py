from datetime import timedelta
from io import StringIO
from unittest.mock import patch

import requests
from django.core.management import call_command
from django.utils import timezone

from . import services
from .models import AuditEvent, PayPalOrder
from .test_api import ApiTestCase, proposal, sock
from .test_orders import http_error


def unique_order(**kwargs):
    return {"id": f"PAYPAL-{kwargs['reference_id']}", "approve_url": "https://paypal.test/approve", "status": "CREATED"}


class OrderLifecycleTests(ApiTestCase):
    def new_order(self, status, age=timedelta(0), amount_cents=1800):
        mandate_id = self.make_mandate()
        order = PayPalOrder.objects.create(
            mandate_id=mandate_id,
            paypal_order_id=f"ORDER-{status}-{PayPalOrder.objects.count()}",
            amount_cents=amount_cents,
            currency="USD",
            status=status,
        )
        PayPalOrder.objects.filter(pk=order.pk).update(created_at=timezone.now() - age)
        order.refresh_from_db()
        return order

    def approved_order(self):
        mandate_id = self.make_mandate()
        with patch("leash.paypal.create_order", side_effect=unique_order):
            self.propose(mandate_id, proposal(sock()))
        return PayPalOrder.objects.get()

    def capture(self, order):
        return self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")


class BudgetReleaseTests(OrderLifecycleTests):
    def test_abandoned_order_stops_counting_toward_the_budget(self):
        mandate_id = self.make_mandate(per_item_cap_cents=5000)
        big = proposal(sock(unit_price_cents=4000))
        with patch("leash.paypal.create_order", side_effect=unique_order):
            self.assertEqual(self.propose(mandate_id, big).data["outcome"], "approve")
            self.assertEqual(self.propose(mandate_id, big).data["outcome"], "block")
            PayPalOrder.objects.update(created_at=timezone.now() - timedelta(hours=4))
            self.assertEqual(self.propose(mandate_id, big).data["outcome"], "approve")

    def test_stale_pending_reservation_stops_counting(self):
        order = self.new_order(PayPalOrder.PENDING, age=timedelta(hours=1))
        self.assertEqual(order.mandate.spent_cents(), 0)

    def test_fresh_pending_reservation_counts(self):
        order = self.new_order(PayPalOrder.PENDING, age=timedelta(minutes=1))
        self.assertEqual(order.mandate.spent_cents(), 1800)

    def test_orders_mid_capture_always_count(self):
        order = self.new_order(PayPalOrder.CAPTURING, age=timedelta(days=2))
        self.assertEqual(order.mandate.spent_cents(), 1800)


class CaptureEdgeCaseTests(OrderLifecycleTests):
    def test_capturing_an_expired_order_is_refused(self):
        order = self.approved_order()
        PayPalOrder.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(hours=4))
        with patch("leash.paypal.capture_order") as capture:
            response = self.capture(order)
        capture.assert_not_called()
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.data["error"]["code"], "order_expired")
        order.refresh_from_db()
        self.assertEqual(order.status, PayPalOrder.EXPIRED)
        self.assertTrue(AuditEvent.objects.filter(kind="order_expired").exists())

    def test_declined_payment_returns_409_and_keeps_the_order_open(self):
        order = self.approved_order()
        error = http_error(422, {"details": [{"issue": "INSTRUMENT_DECLINED"}]})
        with patch("leash.paypal.capture_order", side_effect=error):
            response = self.capture(order)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "payment_declined")
        order.refresh_from_db()
        self.assertEqual(order.status, PayPalOrder.CREATED)

    def test_already_captured_order_is_treated_as_completed(self):
        order = self.approved_order()
        error = http_error(422, {"details": [{"issue": "ORDER_ALREADY_CAPTURED"}]})
        with patch("leash.paypal.capture_order", side_effect=error):
            response = self.capture(order)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "completed")


class MaintenanceTests(OrderLifecycleTests):
    def test_expiry_job_only_touches_stale_orders(self):
        stale_created = self.new_order(PayPalOrder.CREATED, age=timedelta(hours=4))
        stale_pending = self.new_order(PayPalOrder.PENDING, age=timedelta(hours=1))
        fresh = self.new_order(PayPalOrder.CREATED, age=timedelta(minutes=5))
        self.assertEqual(services.expire_stale_orders(), 2)
        for order, expected in (
            (stale_created, PayPalOrder.EXPIRED),
            (stale_pending, PayPalOrder.EXPIRED),
            (fresh, PayPalOrder.CREATED),
        ):
            order.refresh_from_db()
            self.assertEqual(order.status, expected)
        self.assertEqual(AuditEvent.objects.filter(kind="order_expired").count(), 2)

    def test_command_settles_orders_stuck_mid_capture(self):
        done = self.new_order(PayPalOrder.CAPTURING)
        retry = self.new_order(PayPalOrder.CAPTURING)
        answers = {done.paypal_order_id: {"status": "COMPLETED"}, retry.paypal_order_id: {"status": "APPROVED"}}
        with patch("leash.paypal.get_order", side_effect=lambda order_id: answers[order_id]):
            call_command("maintain_orders", stdout=StringIO())
        done.refresh_from_db()
        retry.refresh_from_db()
        self.assertEqual(done.status, PayPalOrder.COMPLETED)
        self.assertEqual(retry.status, PayPalOrder.CREATED)

    def test_unreachable_paypal_leaves_stuck_orders_alone(self):
        stuck = self.new_order(PayPalOrder.CAPTURING)
        with patch("leash.paypal.get_order", side_effect=requests.ConnectionError()):
            counts = services.reconcile_capturing()
        stuck.refresh_from_db()
        self.assertEqual(stuck.status, PayPalOrder.CAPTURING)
        self.assertEqual(counts["unchanged"], 1)
