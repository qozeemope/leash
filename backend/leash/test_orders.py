import json
from unittest.mock import patch

import requests

from .models import PayPalOrder
from .test_api import PAYPAL_ORDER, ApiTestCase, proposal, sock


def http_error(status_code, body):
    response = requests.Response()
    response.status_code = status_code
    response._content = json.dumps(body).encode()
    return requests.HTTPError(response=response)


class CaptureErrorTests(ApiTestCase):
    def approved_order(self):
        mandate_id = self.make_mandate()
        with patch("leash.paypal.create_order", return_value=PAYPAL_ORDER):
            self.propose(mandate_id, proposal(sock()))
        return PayPalOrder.objects.get()

    def test_capture_before_buyer_approval_returns_409(self):
        order = self.approved_order()
        error = http_error(422, {"name": "UNPROCESSABLE_ENTITY", "details": [{"issue": "ORDER_NOT_APPROVED"}]})
        with patch("leash.paypal.capture_order", side_effect=error):
            response = self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "order_not_approved")
        order.refresh_from_db()
        self.assertEqual(order.status, PayPalOrder.CREATED)

    def test_other_paypal_errors_return_502_and_allow_retry(self):
        order = self.approved_order()
        with patch("leash.paypal.capture_order", side_effect=http_error(500, {"message": "boom"})):
            response = self.client.post(f"/api/orders/{order.paypal_order_id}/capture/")
        self.assertEqual(response.status_code, 502)
        order.refresh_from_db()
        self.assertEqual(order.status, PayPalOrder.CREATED)
