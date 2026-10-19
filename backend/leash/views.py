import uuid

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import paypal
from .models import AuditEvent, MandateRecord, PayPalOrder
from .policy import (
    CartItem,
    Mandate,
    Outcome,
    ProposedAction,
    evaluate,
    sign_mandate,
    verify_mandate,
)

SECRET = settings.SECRET_KEY.encode()


def _action_from_json(d: dict) -> ProposedAction:
    items = tuple(
        CartItem(
            title=i["title"],
            category=i["category"],
            unit_price_cents=int(i["unit_price_cents"]),
            quantity=int(i.get("quantity", 1)),
            merchant=i.get("merchant", "unknown"),
            merchant_rating=i.get("merchant_rating"),
            delivery_days=i.get("delivery_days"),
        )
        for i in d.get("items", [])
    )
    return ProposedAction(
        kind=d.get("kind", "checkout"),
        items=items,
        currency=d.get("currency", "USD"),
        origin=d.get("origin", "agent"),
        agent_reason=d.get("agent_reason", ""),
    )


def _create_paypal_order(record: MandateRecord, action: ProposedAction) -> PayPalOrder:
    ref = str(uuid.uuid4())
    result = paypal.create_order(
        amount_cents=action.total_cents,
        currency=action.currency,
        description="; ".join(i.title for i in action.items),
        reference_id=ref,
        return_url=f"{settings.FRONTEND_URL}/checkout/return",
        cancel_url=f"{settings.FRONTEND_URL}/checkout/cancel",
    )
    return PayPalOrder.objects.create(
        mandate=record,
        paypal_order_id=result["id"],
        amount_cents=action.total_cents,
        currency=action.currency.upper(),
        approve_url=result["approve_url"],
    )


@api_view(["POST"])
def create_mandate(request):
    raw_text = request.data.get("raw_text", "")
    terms = {**request.data["terms"], "mandate_id": str(uuid.uuid4())}
    mandate = Mandate.from_dict(terms)
    record = MandateRecord.objects.create(
        id=mandate.mandate_id,
        raw_text=raw_text,
        terms=mandate.to_dict(),
        signature=sign_mandate(mandate, SECRET),
    )
    return Response({"id": str(record.id), "terms": record.terms}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def propose(request, mandate_id):
    record = get_object_or_404(MandateRecord, pk=mandate_id)
    mandate = record.to_policy()
    action = _action_from_json(request.data)

    if not verify_mandate(mandate, record.signature, SECRET):
        AuditEvent.objects.create(
            mandate=record, kind="proposal", outcome=Outcome.BLOCK.value,
            rule_hits=[{"rule_id": "R_SIGNATURE", "outcome": "block",
                        "message": "Mandate signature invalid; terms were modified."}],
            payload=request.data,
        )
        return Response({"outcome": "block", "reasons": ["Mandate signature invalid."]},
                        status=status.HTTP_403_FORBIDDEN)

    decision = evaluate(mandate, action, spent_cents=record.spent_cents())

    event = AuditEvent.objects.create(
        mandate=record, kind="proposal", outcome=decision.outcome.value,
        rule_hits=[h.to_dict() for h in decision.hits], payload=request.data,
        resolution=AuditEvent.OPEN if decision.outcome is Outcome.ESCALATE else AuditEvent.NA,
    )

    if decision.outcome is Outcome.BLOCK:
        return Response({"outcome": "block", "reasons": decision.reasons, "event_id": event.id})

    if decision.outcome is Outcome.ESCALATE:
        return Response({"outcome": "escalate", "reasons": decision.reasons, "event_id": event.id})

    if action.kind != "checkout": 
        return Response({"outcome": "approve", "event_id": event.id})

    order = _create_paypal_order(record, action)
    AuditEvent.objects.create(mandate=record, kind="order_created", outcome="approve",
                              payload={"paypal_order_id": order.paypal_order_id})
    return Response({"outcome": "approve", "event_id": event.id,
                     "paypal_order_id": order.paypal_order_id, "approve_url": order.approve_url})


@api_view(["GET"])
def audit_log(request, mandate_id):
    record = get_object_or_404(MandateRecord, pk=mandate_id)
    rows = [
        {
            "id": e.id,
            "time": e.created_at.isoformat(),
            "kind": e.kind,
            "outcome": e.outcome,
            "rules": ", ".join(h["rule_id"] for h in e.rule_hits),
            "reasons": " | ".join(h["message"] for h in e.rule_hits),
            "resolution": e.resolution,
            "summary": ", ".join(i.get("title", "?") for i in e.payload.get("items", [])),
        }
        for e in record.events.all()
    ]
    return Response({"mandate": record.terms, "spent_cents": record.spent_cents(), "rows": rows})


@api_view(["POST"])
def resolve_escalation(request, event_id):
    event = get_object_or_404(AuditEvent, pk=event_id, outcome="escalate", resolution=AuditEvent.OPEN)
    decision = request.data.get("decision")
    if decision not in ("approve", "deny"):
        return Response({"error": "decision must be 'approve' or 'deny'"}, status=400)

    if decision == "deny":
        event.resolution = AuditEvent.DENIED
        event.save(update_fields=["resolution"])
        return Response({"resolution": "denied"})

    event.resolution = AuditEvent.APPROVED
    event.save(update_fields=["resolution"])
    order = _create_paypal_order(event.mandate, _action_from_json(event.payload))
    return Response({"resolution": "approved", "paypal_order_id": order.paypal_order_id,
                     "approve_url": order.approve_url})


@api_view(["POST"])
def capture(request, paypal_order_id):
    order = get_object_or_404(PayPalOrder, paypal_order_id=paypal_order_id)
    try:
        result = paypal.capture_order(paypal_order_id)
    except Exception as exc:  
        order.status = PayPalOrder.FAILED
        order.save(update_fields=["status"])
        return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    order.status = PayPalOrder.COMPLETED if result.get("status") == "COMPLETED" else PayPalOrder.FAILED
    order.save(update_fields=["status"])
    AuditEvent.objects.create(mandate=order.mandate, kind="order_captured", outcome="approve",
                              payload={"paypal_order_id": paypal_order_id, "status": result.get("status")})
    return Response({"status": order.status})
