import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

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

    def spent_cents(self, now=None) -> int:
        now = now or timezone.now()
        counted = (
            Q(status__in=[PayPalOrder.CAPTURING, PayPalOrder.COMPLETED])
            | Q(status=PayPalOrder.PENDING, created_at__gte=PayPalOrder.pending_cutoff(now))
            | Q(status=PayPalOrder.CREATED, created_at__gte=PayPalOrder.approval_cutoff(now))
        )
        total = self.orders.filter(counted).aggregate(total=Sum("amount_cents"))["total"]
        return total or 0


class AuditEvent(models.Model):
    OPEN, APPROVED, DENIED, NA = "open", "approved", "denied", "n/a"
    RESOLUTIONS = [(OPEN, "Open"), (APPROVED, "Approved"), (DENIED, "Denied"), (NA, "Not applicable")]
    KINDS = [
        ("proposal", "Proposal"),
        ("order_created", "Order created"),
        ("order_failed", "Order failed"),
        ("order_expired", "Order expired"),
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
    PENDING, CREATED, CAPTURING, COMPLETED, FAILED, EXPIRED = (
        "pending",
        "created",
        "capturing",
        "completed",
        "failed",
        "expired",
    )
    STATUSES = [
        (PENDING, "Pending"),
        (CREATED, "Created"),
        (CAPTURING, "Capturing"),
        (COMPLETED, "Completed"),
        (FAILED, "Failed"),
        (EXPIRED, "Expired"),
    ]

    id = models.BigAutoField(primary_key=True)
    mandate = models.ForeignKey(MandateRecord, on_delete=models.CASCADE, related_name="orders")
    reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    paypal_order_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    approve_url = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=16, choices=STATUSES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["mandate", "status"])]
        constraints = [
            models.CheckConstraint(condition=Q(amount_cents__gt=0), name="paypalorder_amount_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.paypal_order_id or self.reference} {self.status}"

    @staticmethod
    def pending_cutoff(now):
        return now - timedelta(minutes=settings.ORDER_PENDING_TTL_MINUTES)

    @staticmethod
    def approval_cutoff(now):
        return now - timedelta(minutes=settings.ORDER_APPROVAL_TTL_MINUTES)

    def is_expired(self, now=None) -> bool:
        now = now or timezone.now()
        if self.status == self.PENDING:
            return self.created_at < self.pending_cutoff(now)
        if self.status == self.CREATED:
            return self.created_at < self.approval_cutoff(now)
        return False


class LLMUsage(models.Model):
    day = models.DateField(unique=True)
    calls = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveBigIntegerField(default=0)
    output_tokens = models.PositiveBigIntegerField(default=0)

    class Meta:
        ordering = ["-day"]

    def __str__(self) -> str:
        return f"{self.day}: {self.calls} calls"


class AgentRun(models.Model):
    RUNNING, COMPLETED, FAILED = "running", "completed", "failed"
    STATUSES = [(RUNNING, "Running"), (COMPLETED, "Completed"), (FAILED, "Failed")]
    LIVE = "live"
    SECURITY_TEST = "security_test"
    ATTACK_GIFT_CARD = "attack_gift_card"
    ATTACK_OVERSPEND = "attack_overspend"
    ATTACK_BANNED_MERCHANT = "attack_banned_merchant"
    MODES = [
        (LIVE, "Live"),
        (SECURITY_TEST, "Security test"),
        (ATTACK_GIFT_CARD, "Simulated attack: gift card"),
        (ATTACK_OVERSPEND, "Simulated attack: oversized order"),
        (ATTACK_BANNED_MERCHANT, "Simulated attack: banned merchant"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mandate = models.ForeignKey(MandateRecord, on_delete=models.CASCADE, related_name="agent_runs")
    mode = models.CharField(max_length=24, choices=MODES, default=LIVE)
    request_text = models.TextField()
    status = models.CharField(max_length=16, choices=STATUSES, default=RUNNING)
    final_message = models.TextField(blank=True)
    tainted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Run {str(self.id)[:8]} {self.status}"


class AgentStep(models.Model):
    id = models.BigAutoField(primary_key=True)
    run = models.ForeignKey(AgentRun, on_delete=models.CASCADE, related_name="steps")
    kind = models.CharField(max_length=24)
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["run", "id"])]

    def __str__(self) -> str:
        return f"{self.kind} #{self.id}"
