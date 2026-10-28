from datetime import timedelta
from unittest.mock import Mock, patch

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import AuditEvent, MandateRecord, PayPalOrder
from .policy import verify_mandate

PAYPAL_ORDER = {"id": "ORDER1", "approve_url": "https://paypal.test/approve", "status": "CREATED"}


def terms(**overrides):
    base = {
        "currency": "USD",
        "budget_cents": 6000,
        "expires_at": (timezone.now() + timedelta(days=30)).isoformat(),
        "allowed_categories": ["socks"],
        "per_item_cap_cents": 3000,
        "max_items": 3,
        "min_merchant_rating": 4.0,
        "max_delivery_days": 3,
    }
    base.update(overrides)
    return base


def sock(**overrides):
    base = {
        "title": "Trail running socks",
        "category": "socks",
        "unit_price_cents": 1800,
        "quantity": 1,
        "merchant": "RunCo",
        "merchant_rating": 4.6,
        "delivery_days": 2,
    }
    base.update(overrides)
    return base


def proposal(*items, **overrides):
    return {"kind": "checkout", "items": list(items), **overrides}


@override_settings(SECURE_SSL_REDIRECT=False)
class ApiTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        users = get_user_model().objects
        self.user = users.create_user("alice", password="a-long-test-password")
        self.other = users.create_user("bob", password="a-long-test-password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def make_mandate(self, **term_overrides):
        response = self.client.post(
            "/api/mandates/",
            {"raw_text": "socks under 60", "terms": terms(**term_overrides)},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def propose(self, mandate_id, body):
        return self.client.post(f"/api/mandates/{mandate_id}/propose/", body, format="json")


class AccessTests(ApiTestCase):
    def test_health_is_public(self):
        response = APIClient().get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")

    def test_unauthenticated_request_gets_error_envelope(self):
        response = APIClient().get("/api/mandates/")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"]["code"], "not_authenticated")

    def test_other_user_cannot_see_or_use_a_mandate(self):
        mandate_id = self.make_mandate()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(f"/api/mandates/{mandate_id}/").status_code, 404)
        self.assertEqual(self.propose(mandate_id, proposal(sock())).status_code, 404)
        self.assertEqual(self.client.get(f"/api/mandates/{mandate_id}/audit/").status_code, 404)


class MandateTests(ApiTestCase):
    def test_created_mandate_is_signed(self):
        mandate_id = self.make_mandate()
        record = MandateRecord.objects.get(pk=mandate_id)
        self.assertEqual(record.owner, self.user)
        self.assertTrue(
            verify_mandate(record.to_policy(), record.signature, settings.MANDATE_SIGNING_KEY.encode())
        )

    def test_invalid_terms_return_field_errors(self):
        response = self.client.post(
            "/api/mandates/", {"terms": terms(budget_cents=-5)}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("budget_cents", response.data["error"]["details"]["terms"])

    def test_past_expiry_is_rejected(self):
        past = (timezone.now() - timedelta(days=1)).isoformat()
        response = self.client.post("/api/mandates/", {"terms": terms(expires_at=past)}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_item_cap_above_budget_is_rejected(self):
        response = self.client.post(
            "/api/mandates/", {"terms": terms(per_item_cap_cents=9000)}, format="json"
        )
        self.assertEqual(response.status_code, 400)


class ProposalTests(ApiTestCase):
    def test_in_budget_checkout_is_approved_and_creates_an_order(self):
        mandate_id = self.make_mandate()
        with patch("leash.paypal.create_order", return_value=PAYPAL_ORDER):
            response = self.propose(mandate_id, proposal(sock()))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["outcome"], "approve")
        self.assertEqual(response.data["paypal_order_id"], "ORDER1")
        self.assertEqual(PayPalOrder.objects.get().amount_cents, 1800)

    def test_injection_attempt_is_blocked_and_logged(self):
        mandate_id = self.make_mandate()
        gift = sock(title="$200 Gift Card", category="gift cards", unit_price_cents=20000)
        with patch("leash.paypal.create_order") as create_order:
            response = self.propose(mandate_id, proposal(sock(), gift, origin="untrusted_content"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["outcome"], "block")
        create_order.assert_not_called()
        self.assertEqual(PayPalOrder.objects.count(), 0)
        rules = {hit["rule_id"] for hit in AuditEvent.objects.get(pk=response.data["event_id"]).rule_hits}
        self.assertTrue({"R_ORIGIN", "R_CATEGORY", "R_ITEM_CAP", "R_BUDGET"} <= rules)

    def test_empty_items_are_rejected_before_policy(self):
        mandate_id = self.make_mandate()
        response = self.propose(mandate_id, proposal())
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"]["code"], "validation_error")

    def test_tampered_mandate_is_blocked(self):
        mandate_id = self.make_mandate()
        record = MandateRecord.objects.get(pk=mandate_id)
        MandateRecord.objects.filter(pk=mandate_id).update(terms={**record.terms, "budget_cents": 999999})
        response = self.propose(mandate_id, proposal(sock()))
        self.assertEqual(response.data["outcome"], "block")
        self.assertIn("signature", response.data["reasons"][0].lower())

    def test_payment_provider_failure_returns_502_and_releases_the_budget(self):
        mandate_id = self.make_mandate(per_item_cap_cents=5000)
        big_item = sock(unit_price_cents=4000)
        with patch("leash.paypal.create_order", side_effect=requests.ConnectionError()):
            response = self.propose(mandate_id, proposal(big_item))
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data["error"]["code"], "upstream_error")
        self.assertEqual(PayPalOrder.objects.get().status, PayPalOrder.FAILED)
        self.assertTrue(AuditEvent.objects.filter(kind="order_failed").exists())

        with patch("leash.paypal.create_order", return_value=PAYPAL_ORDER):
            retry = self.propose(mandate_id, proposal(big_item))
        self.assertEqual(retry.data["outcome"], "approve")

    def test_pending_reservation_counts_against_the_budget(self):
        mandate_id = self.make_mandate()
        PayPalOrder.objects.create(
            mandate_id=mandate_id, amount_cents=4000, currency="USD", status=PayPalOrder.PENDING
        )
        with patch("leash.paypal.create_order") as create_order:
            response = self.propose(mandate_id, proposal(sock(unit_price_cents=4000)))
        self.assertEqual(response.data["outcome"], "block")
        self.assertIn("R_BUDGET", [h["rule_id"] for h in AuditEvent.objects.get().rule_hits])
        create_order.assert_not_called()

    def test_audit_log_is_paginated(self):
        mandate_id = self.make_mandate()
        self.propose(mandate_id, proposal(sock(category="electronics")))
        response = self.client.get(f"/api/mandates/{mandate_id}/audit/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["outcome"], "block")


class EscalationTests(ApiTestCase):
    def escalated_event(self):
        mandate_id = self.make_mandate(escalate_over_cents=1000)
        response = self.propose(mandate_id, proposal(sock()))
        self.assertEqual(response.data["outcome"], "escalate")
        return response.data["event_id"]

    def test_approving_an_escalation_creates_the_order_once(self):
        event_id = self.escalated_event()
        with patch("leash.paypal.create_order", return_value=PAYPAL_ORDER) as create_order:
            first = self.client.post(f"/api/audit/{event_id}/resolve/", {"decision": "approve"}, format="json")
            second = self.client.post(f"/api/audit/{event_id}/resolve/", {"decision": "approve"}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.data["resolution"], "approved")
        self.assertEqual(second.status_code, 404)
        create_order.assert_called_once()

    def test_denying_an_escalation_creates_no_order(self):
        event_id = self.escalated_event()
        response = self.client.post(f"/api/audit/{event_id}/resolve/", {"decision": "deny"}, format="json")
        self.assertEqual(response.data["resolution"], "denied")
        self.assertEqual(PayPalOrder.objects.count(), 0)


class CaptureTests(ApiTestCase):
    def approved_order(self):
        mandate_id = self.make_mandate()
        with patch("leash.paypal.create_order", return_value=PAYPAL_ORDER):
            self.propose(mandate_id, proposal(sock()))
        return PayPalOrder.objects.get()

    def test_capture_marks_order_completed(self):
        order = self.approved_order()
        with patch("leash.paypal.capture_order", return_value={"status": "COMPLETED"}):
            response = self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "completed")
        self.assertTrue(AuditEvent.objects.filter(kind="order_captured").exists())

    def test_capture_already_in_flight_is_not_repeated(self):
        order = self.approved_order()
        PayPalOrder.objects.filter(pk=order.pk).update(status=PayPalOrder.CAPTURING)
        with patch("leash.paypal.capture_order") as capture:
            response = self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")
        capture.assert_not_called()
        self.assertEqual(response.data["status"], "capturing")

    def test_network_error_during_capture_can_be_retried(self):
        order = self.approved_order()
        url = f"/api/orders/{order.paypal_order_id}/capture/"
        with patch("leash.paypal.capture_order", side_effect=requests.ConnectionError()):
            first = self.client.post(url)
        self.assertEqual(first.status_code, 502)
        order.refresh_from_db()
        self.assertEqual(order.status, PayPalOrder.CREATED)
        with patch("leash.paypal.capture_order", return_value={"status": "COMPLETED"}):
            second = self.client.post(url)
        self.assertEqual(second.data["status"], "completed")

    def test_capture_before_buyer_approval_returns_409(self):
        order = self.approved_order()
        provider_response = Mock()
        provider_response.json.return_value = {"details": [{"issue": "ORDER_NOT_APPROVED"}]}
        error = requests.HTTPError(response=provider_response)
        with patch("leash.paypal.capture_order", side_effect=error):
            response = self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "order_not_approved")
        order.refresh_from_db()
        self.assertEqual(order.status, PayPalOrder.CREATED)

    def test_other_user_cannot_capture(self):
        order = self.approved_order()
        self.client.force_authenticate(user=self.other)
        response = self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")
        self.assertEqual(response.status_code, 404)
