import uuid

import requests
from django.conf import settings
from rest_framework.exceptions import APIException

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


def _create_order(record: MandateRecord, action: ProposedAction) -> PayPalOrder:
    try:
        result = paypal.create_order(
            amount_cents=action.total_cents,
            currency=action.currency,
            description="; ".join(item.title for item in action.items),
            reference_id=str(uuid.uuid4()),
            return_url=f"{settings.FRONTEND_URL}/checkout/return",
            cancel_url=f"{settings.FRONTEND_URL}/checkout/cancel",
        )
    except (requests.RequestException, KeyError) as exc:
        raise UpstreamError() from exc
    return PayPalOrder.objects.create(
        mandate=record,
        paypal_order_id=result["id"],
        amount_cents=action.total_cents,
        currency=action.currency.upper(),
        approve_url=result["approve_url"],
    )


def _signature_hit() -> dict:
    return {
        "rule_id": "R_SIGNATURE",
        "outcome": Outcome.BLOCK.value,
        "message": "Mandate signature is invalid; its terms were modified.",
    }


def submit_proposal(record: MandateRecord, action: ProposedAction, payload: dict) -> dict:
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
        return {"outcome": Outcome.BLOCK.value, "reasons": [hit["message"]], "event_id": event.id}

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

    if decision.outcome is Outcome.APPROVE and action.kind == "checkout":
        order = _create_order(record, action)
        AuditEvent.objects.create(
            mandate=record,
            kind="order_created",
            payload={"paypal_order_id": order.paypal_order_id},
        )
        result["paypal_order_id"] = order.paypal_order_id
        result["approve_url"] = order.approve_url
    return result


def resolve_escalation(event: AuditEvent, decision: str) -> dict:
    if decision == "deny":
        event.resolution = AuditEvent.DENIED
        event.save(update_fields=["resolution"])
        return {"resolution": AuditEvent.DENIED}

    record = event.mandate
    mandate = record.to_policy()
    action = action_from_payload(event.payload)
    fresh = evaluate(mandate, action, spent_cents=record.spent_cents())
    signature_ok = verify_mandate(mandate, record.signature, _signing_key())

    if not signature_ok or fresh.outcome is Outcome.BLOCK:
        event.resolution = AuditEvent.DENIED
        event.save(update_fields=["resolution"])
        reasons = fresh.reasons if signature_ok else [_signature_hit()["message"]]
        return {"resolution": AuditEvent.DENIED, "reasons": reasons}

    event.resolution = AuditEvent.APPROVED
    event.save(update_fields=["resolution"])
    result = {"resolution": AuditEvent.APPROVED}
    if action.kind == "checkout":
        order = _create_order(record, action)
        AuditEvent.objects.create(
            mandate=record,
            kind="order_created",
            payload={"paypal_order_id": order.paypal_order_id},
        )
        result["paypal_order_id"] = order.paypal_order_id
        result["approve_url"] = order.approve_url
    return result


def capture_order(order: PayPalOrder) -> PayPalOrder:
    if order.status == PayPalOrder.COMPLETED:
        return order
    try:
        result = paypal.capture_order(order.paypal_order_id)
    except (requests.RequestException, KeyError) as exc:
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
