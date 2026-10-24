import uuid

import requests
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import APIException, NotFound

from . import paypal
from .models import AuditEvent, MandateRecord, PayPalOrder
from .policy import Mandate, Outcome, ProposedAction, evaluate, sign_mandate, verify_mandate
from .serializers import ProposalSerializer


class UpstreamError(APIException):
    status_code = 502
    default_detail = "The payment provider could not complete the request."
    default_code = "upstream_error"


def _signing_key() -> bytes:
    return settings.MANDATE_SIGNING_KEY.encode()


def build_mandate(terms: dict, mandate_id) -> Mandate:
    return Mandate(
        mandate_id=str(mandate_id),
        currency=terms["currency"].upper(),
        budget_cents=terms["budget_cents"],
        expires_at=terms["expires_at"],
        allowed_categories=tuple(terms["allowed_categories"]),
        per_item_cap_cents=terms["per_item_cap_cents"],
        max_items=terms["max_items"],
        min_merchant_rating=terms["min_merchant_rating"],
        max_delivery_days=terms["max_delivery_days"],
        escalate_over_cents=terms["escalate_over_cents"],
        blocked_merchants=tuple(terms["blocked_merchants"]),
    )


def create_signed_mandate(owner, raw_text: str, mandate: Mandate) -> MandateRecord:
    return MandateRecord.objects.create(
        id=uuid.UUID(mandate.mandate_id),
        owner=owner,
        raw_text=raw_text,
        terms=mandate.to_dict(),
        signature=sign_mandate(mandate, _signing_key()),
    )


def action_from_payload(payload: dict) -> ProposedAction:
    serializer = ProposalSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    return serializer.to_action()


def _signature_hit() -> dict:
    return {
        "rule_id": "R_SIGNATURE",
        "outcome": Outcome.BLOCK.value,
        "message": "Mandate signature is invalid; its terms were modified.",
    }


def _reserve_order(record: MandateRecord, action: ProposedAction) -> PayPalOrder:
    return PayPalOrder.objects.create(
        mandate=record,
        amount_cents=action.total_cents,
        currency=action.currency.upper(),
        status=PayPalOrder.PENDING,
    )


def _place_order(order: PayPalOrder, action: ProposedAction) -> None:
    try:
        result = paypal.create_order(
            amount_cents=order.amount_cents,
            currency=order.currency,
            description="; ".join(item.title for item in action.items),
            reference_id=str(order.reference),
            return_url=f"{settings.FRONTEND_URL}/checkout/return",
            cancel_url=f"{settings.FRONTEND_URL}/checkout/cancel",
        )
    except (requests.RequestException, KeyError) as exc:
        order.status = PayPalOrder.FAILED
        order.save(update_fields=["status"])
        AuditEvent.objects.create(
            mandate=order.mandate,
            kind="order_failed",
            payload={"reference": str(order.reference)},
        )
        raise UpstreamError() from exc

    order.paypal_order_id = result["id"]
    order.approve_url = result["approve_url"]
    order.status = PayPalOrder.CREATED
    order.save(update_fields=["paypal_order_id", "approve_url", "status"])
    AuditEvent.objects.create(
        mandate=order.mandate,
        kind="order_created",
        payload={"paypal_order_id": order.paypal_order_id},
    )


def _decide(record: MandateRecord, action: ProposedAction, payload: dict):
    mandate = record.to_policy()

    if not verify_mandate(mandate, record.signature, _signing_key()):
        hit = _signature_hit()
        event = AuditEvent.objects.create(
            mandate=record,
            kind="proposal",
            outcome=Outcome.BLOCK.value,
            rule_hits=[hit],
            payload=payload,
        )
        return {"outcome": Outcome.BLOCK.value, "reasons": [hit["message"]], "event_id": event.id}, None

    decision = evaluate(mandate, action, spent_cents=record.spent_cents())
    event = AuditEvent.objects.create(
        mandate=record,
        kind="proposal",
        outcome=decision.outcome.value,
        rule_hits=[hit.to_dict() for hit in decision.hits],
        payload=payload,
        resolution=AuditEvent.OPEN if decision.outcome is Outcome.ESCALATE else AuditEvent.NA,
    )
    result = {"outcome": decision.outcome.value, "reasons": decision.reasons, "event_id": event.id}

    order = None
    if decision.outcome is Outcome.APPROVE and action.kind == "checkout":
        order = _reserve_order(record, action)
    return result, order


def submit_proposal(record: MandateRecord, action: ProposedAction, payload: dict) -> dict:
    with transaction.atomic():
        locked = MandateRecord.objects.select_for_update().get(pk=record.pk)
        result, order = _decide(locked, action, payload)

    if order is not None:
        _place_order(order, action)
        result["paypal_order_id"] = order.paypal_order_id
        result["approve_url"] = order.approve_url
    return result


def _resolve(event: AuditEvent, decision: str):
    if decision == "deny":
        event.resolution = AuditEvent.DENIED
        event.save(update_fields=["resolution"])
        return {"resolution": AuditEvent.DENIED}, None, None

    record = MandateRecord.objects.select_for_update().get(pk=event.mandate_id)
    mandate = record.to_policy()
    action = action_from_payload(event.payload)
    fresh = evaluate(mandate, action, spent_cents=record.spent_cents())
    signature_ok = verify_mandate(mandate, record.signature, _signing_key())

    if not signature_ok or fresh.outcome is Outcome.BLOCK:
        event.resolution = AuditEvent.DENIED
        event.save(update_fields=["resolution"])
        reasons = fresh.reasons if signature_ok else [_signature_hit()["message"]]
        return {"resolution": AuditEvent.DENIED, "reasons": reasons}, None, None

    event.resolution = AuditEvent.APPROVED
    event.save(update_fields=["resolution"])
    order = _reserve_order(record, action) if action.kind == "checkout" else None
    return {"resolution": AuditEvent.APPROVED}, order, action


def resolve_escalation(event: AuditEvent, decision: str) -> dict:
    with transaction.atomic():
        locked = AuditEvent.objects.select_for_update().get(pk=event.pk)
        if locked.resolution != AuditEvent.OPEN:
            raise NotFound("This escalation is no longer open.")
        result, order, action = _resolve(locked, decision)

    if order is not None:
        _place_order(order, action)
        result["paypal_order_id"] = order.paypal_order_id
        result["approve_url"] = order.approve_url
    return result


def capture_order(order: PayPalOrder) -> PayPalOrder:
    if order.status == PayPalOrder.COMPLETED:
        return order

    claimed = PayPalOrder.objects.filter(pk=order.pk, status=PayPalOrder.CREATED).update(
        status=PayPalOrder.CAPTURING
    )
    if not claimed:
        order.refresh_from_db()
        return order

    try:
        result = paypal.capture_order(order.paypal_order_id, request_id=str(order.reference))
    except (requests.RequestException, KeyError) as exc:
        PayPalOrder.objects.filter(pk=order.pk).update(status=PayPalOrder.CREATED)
        raise UpstreamError() from exc

    completed = result.get("status") == "COMPLETED"
    order.status = PayPalOrder.COMPLETED if completed else PayPalOrder.FAILED
    order.save(update_fields=["status"])
    AuditEvent.objects.create(
        mandate=order.mandate,
        kind="order_captured",
        payload={"paypal_order_id": order.paypal_order_id, "status": result.get("status")},
    )
    return order
