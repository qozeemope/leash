from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


class Outcome(str, Enum):
    APPROVE = "approve"
    ESCALATE = "escalate"
    BLOCK = "block"


def _norm(s: str) -> str:
    return s.strip().lower()


@dataclass(frozen=True)
class Mandate:
    mandate_id: str
    currency: str
    budget_cents: int
    expires_at: datetime
    allowed_categories: tuple[str, ...]
    per_item_cap_cents: int
    max_items: int = 5
    min_merchant_rating: float = 0.0
    max_delivery_days: Optional[int] = None
    escalate_over_cents: Optional[int] = None
    blocked_merchants: tuple[str, ...] = ()

    def to_dict(self) -> dict:
        return {
            "mandate_id": self.mandate_id,
            "currency": self.currency.upper(),
            "budget_cents": self.budget_cents,
            "expires_at": self.expires_at.astimezone(timezone.utc).isoformat(),
            "allowed_categories": sorted(_norm(c) for c in self.allowed_categories),
            "per_item_cap_cents": self.per_item_cap_cents,
            "max_items": self.max_items,
            "min_merchant_rating": self.min_merchant_rating,
            "max_delivery_days": self.max_delivery_days,
            "escalate_over_cents": self.escalate_over_cents,
            "blocked_merchants": sorted(_norm(m) for m in self.blocked_merchants),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Mandate":
        expires = datetime.fromisoformat(d["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return cls(
            mandate_id=d["mandate_id"],
            currency=d["currency"].upper(),
            budget_cents=int(d["budget_cents"]),
            expires_at=expires,
            allowed_categories=tuple(_norm(c) for c in d["allowed_categories"]),
            per_item_cap_cents=int(d["per_item_cap_cents"]),
            max_items=int(d.get("max_items", 5)),
            min_merchant_rating=float(d.get("min_merchant_rating", 0.0)),
            max_delivery_days=d.get("max_delivery_days"),
            escalate_over_cents=d.get("escalate_over_cents"),
            blocked_merchants=tuple(_norm(m) for m in d.get("blocked_merchants", [])),
        )


def _canonical(mandate: Mandate) -> bytes:
    return json.dumps(mandate.to_dict(), sort_keys=True, separators=(",", ":")).encode()


def sign_mandate(mandate: Mandate, secret: bytes) -> str:
    return hmac.new(secret, _canonical(mandate), hashlib.sha256).hexdigest()


def verify_mandate(mandate: Mandate, signature: str, secret: bytes) -> bool:
    return hmac.compare_digest(sign_mandate(mandate, secret), signature)


@dataclass(frozen=True)
class CartItem:
    title: str
    category: str
    unit_price_cents: int
    quantity: int
    merchant: str
    merchant_rating: Optional[float] = None
    delivery_days: Optional[int] = None

    @property
    def line_total_cents(self) -> int:
        return self.unit_price_cents * self.quantity


@dataclass(frozen=True)
class ProposedAction:
    kind: str
    items: tuple[CartItem, ...]
    currency: str = "USD"
    origin: str = "agent"
    agent_reason: str = ""

    @property
    def total_cents(self) -> int:
        return sum(i.line_total_cents for i in self.items)

    @property
    def total_quantity(self) -> int:
        return sum(i.quantity for i in self.items)


@dataclass(frozen=True)
class RuleHit:
    rule_id: str
    outcome: Outcome
    message: str

    def to_dict(self) -> dict:
        return {"rule_id": self.rule_id, "outcome": self.outcome.value, "message": self.message}


@dataclass(frozen=True)
class Decision:
    outcome: Outcome
    hits: tuple[RuleHit, ...] = field(default_factory=tuple)
    total_cents: int = 0

    @property
    def reasons(self) -> list[str]:
        return [h.message for h in self.hits]

    def to_dict(self) -> dict:
        return {
            "outcome": self.outcome.value,
            "total_cents": self.total_cents,
            "hits": [h.to_dict() for h in self.hits],
        }


def _money(cents: int) -> str:
    return f"${cents // 100}.{cents % 100:02d}"


def evaluate(
    mandate: Mandate,
    action: ProposedAction,
    *,
    spent_cents: int = 0,
    now: Optional[datetime] = None,
) -> Decision:
    now = now or datetime.now(timezone.utc)
    hits: list[RuleHit] = []
    block = lambda rid, msg: hits.append(RuleHit(rid, Outcome.BLOCK, msg))
    escalate = lambda rid, msg: hits.append(RuleHit(rid, Outcome.ESCALATE, msg))

    if now >= mandate.expires_at:
        block("R_EXPIRED", "Mandate has expired.")

    if action.currency.upper() != mandate.currency.upper():
        block("R_CURRENCY", f"Currency {action.currency} does not match mandate ({mandate.currency}).")

    if action.origin == "untrusted_content":
        block("R_ORIGIN", "Action was triggered by untrusted page/tool content, not by the user's mandate.")

    if not action.items:
        block("R_EMPTY", "Action contains no items.")

    if action.total_quantity > mandate.max_items:
        block("R_ITEM_COUNT", f"{action.total_quantity} items exceeds the limit of {mandate.max_items}.")

    projected = spent_cents + action.total_cents
    if projected > mandate.budget_cents:
        block(
            "R_BUDGET",
            f"Total {_money(action.total_cents)} (+{_money(spent_cents)} already spent) "
            f"exceeds the {_money(mandate.budget_cents)} budget.",
        )

    allowed = {_norm(c) for c in mandate.allowed_categories}
    blocked = {_norm(m) for m in mandate.blocked_merchants}
    for item in action.items:
        if _norm(item.merchant) in blocked:
            block("R_MERCHANT", f"Merchant '{item.merchant}' is on the blocked list.")
        if _norm(item.category) not in allowed:
            block("R_CATEGORY", f"'{item.title}' is category '{item.category}', which the mandate does not allow.")

        if item.unit_price_cents > mandate.per_item_cap_cents:
            block(
                "R_ITEM_CAP",
                f"'{item.title}' costs {_money(item.unit_price_cents)}, above the "
                f"{_money(mandate.per_item_cap_cents)} per-item cap.",
            )

        if mandate.min_merchant_rating > 0:
            if item.merchant_rating is None:
                escalate("R_RATING_UNKNOWN", f"Merchant '{item.merchant}' has no rating; needs human review.")
            elif item.merchant_rating < mandate.min_merchant_rating:
                block(
                    "R_RATING",
                    f"Merchant '{item.merchant}' is rated {item.merchant_rating}, "
                    f"below the required {mandate.min_merchant_rating}.",
                )

        if mandate.max_delivery_days is not None and item.delivery_days is not None:
            if item.delivery_days > mandate.max_delivery_days:
                block(
                    "R_DELIVERY",
                    f"'{item.title}' ships in {item.delivery_days} days; limit is {mandate.max_delivery_days}.",
                )

    if mandate.escalate_over_cents is not None and action.total_cents > mandate.escalate_over_cents:
        escalate(
            "R_STEP_UP",
            f"Total {_money(action.total_cents)} is over the {_money(mandate.escalate_over_cents)} "
            f"auto-approve threshold; human confirmation required.",
        )

    if any(h.outcome is Outcome.BLOCK for h in hits):
        outcome = Outcome.BLOCK
    elif any(h.outcome is Outcome.ESCALATE for h in hits):
        outcome = Outcome.ESCALATE
    else:
        outcome = Outcome.APPROVE
    return Decision(outcome=outcome, hits=tuple(hits), total_cents=action.total_cents)
