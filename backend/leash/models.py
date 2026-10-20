import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum

from .policy import Mandate, Outcome


class MandateRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mandates")
    raw_text = models.TextField(blank=True)
    terms = models.JSONField()
    signature = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Mandate {str(self.id)[:8]} ({self.owner})"

    def to_policy(self) -> Mandate:
        return Mandate.from_dict(self.terms)

    def spent_cents(self) -> int:
        committed = [PayPalOrder.CREATED, PayPalOrder.COMPLETED]
        total = self.orders.filter(status__in=committed).aggregate(total=Sum("amount_cents"))["total"]
        return total or 0


class AuditEvent(models.Model):
    OPEN, APPROVED, DENIED, NA = "open", "approved", "denied", "n/a"
    RESOLUTIONS = [(OPEN, "Open"), (APPROVED, "Approved"), (DENIED, "Denied"), (NA, "Not applicable")]
    KINDS = [
        ("proposal", "Proposal"),
        ("order_created", "Order created"),
        ("order_captured", "Order captured"),
    ]
    OUTCOMES = [(o.value, o.name.title()) for o in Outcome]

    id = models.BigAutoField(primary_key=True)
    mandate = models.ForeignKey(MandateRecord, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=32, choices=KINDS)
    outcome = models.CharField(max_length=16, choices=OUTCOMES, blank=True)
    rule_hits = models.JSONField(default=list)
    payload = models.JSONField(default=dict)
    resolution = models.CharField(max_length=16, choices=RESOLUTIONS, default=NA)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["mandate", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.kind} {self.outcome} ({self.created_at:%Y-%m-%d %H:%M})"


class PayPalOrder(models.Model):
    CREATED, COMPLETED, FAILED = "created", "completed", "failed"
    STATUSES = [(CREATED, "Created"), (COMPLETED, "Completed"), (FAILED, "Failed")]

    id = models.BigAutoField(primary_key=True)
    mandate = models.ForeignKey(MandateRecord, on_delete=models.CASCADE, related_name="orders")
    paypal_order_id = models.CharField(max_length=64, unique=True)
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    approve_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=16, choices=STATUSES, default=CREATED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["mandate", "status"])]
        constraints = [
            models.CheckConstraint(condition=Q(amount_cents__gt=0), name="paypalorder_amount_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.paypal_order_id} {self.status}"
