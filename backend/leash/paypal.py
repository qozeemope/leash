import time

import requests
from django.conf import settings

_token_cache = {"value": None, "expires_at": 0.0}


def _base() -> str:
    return settings.PAYPAL_BASE_URL


def _access_token() -> str:
    if _token_cache["value"] and time.time() < _token_cache["expires_at"] - 30:
        return _token_cache["value"]
    resp = requests.post(
        f"{_base()}/v1/oauth2/token",
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["value"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + int(data.get("expires_in", 300))
    return _token_cache["value"]


def _headers(request_id: str | None = None) -> dict:
    h = {"Authorization": f"Bearer {_access_token()}", "Content-Type": "application/json"}
    if request_id:
        h["PayPal-Request-Id"] = request_id
    return h


def _fmt(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def create_order(*, amount_cents: int, currency: str, description: str, reference_id: str,
                 return_url: str, cancel_url: str) -> dict:
    body = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": reference_id,
            "description": description[:127],
            "amount": {"currency_code": currency.upper(), "value": _fmt(amount_cents)},
        }],
        "payment_source": {"paypal": {"experience_context": {
            "brand_name": "Leash",
            "shipping_preference": "NO_SHIPPING",
            "return_url": return_url,
            "cancel_url": cancel_url,
            "brand_name": "Leash",
            "user_action": "PAY_NOW",
        }}},
    }
    resp = requests.post(f"{_base()}/v2/checkout/orders", json=body,
                         headers=_headers(request_id=reference_id), timeout=20)
    resp.raise_for_status()
    data = resp.json()
    approve_url = next(
        (l["href"] for l in data.get("links", []) if l.get("rel") in ("payer-action", "approve")), ""
    )
    return {"id": data["id"], "approve_url": approve_url, "status": data["status"]}


def capture_order(paypal_order_id: str, request_id: str | None = None) -> dict:
    resp = requests.post(f"{_base()}/v2/checkout/orders/{paypal_order_id}/capture",
                         headers=_headers(request_id=request_id), timeout=20)
    resp.raise_for_status()
    return resp.json()


def get_order(paypal_order_id: str) -> dict:
    resp = requests.get(f"{_base()}/v2/checkout/orders/{paypal_order_id}", headers=_headers(), timeout=20)
    resp.raise_for_status()
    return resp.json()
