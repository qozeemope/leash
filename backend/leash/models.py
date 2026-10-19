import uuid

from django.db import models
from django.db.models import Sum

from .policy import Mandate


class MandateRecord(models.Model):
    

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    raw_text = models.TextField(help_text="What the user actually typed.")
    terms = models.JSONField(help_text="Structured terms (Mandate.to_dict()) the LLM extracted.")
    signature = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    def to_policy(self) -> Mandate:
        return Mandate.from_dict(self.terms)

    def spent_cents(self) -> int:
      
        total = self.orders.filter(status__in=[PayPalOrder.CREATED, PayPalOrder.COMPLETED]).aggregate(
            s=Sum("amount_cents")
        )["s"]
        return total or 0


class AuditEvent(models.Model):
   

    OPEN, APPROVED, DENIED, NA = "open", "approved", "denied", "n/a"

    id = models.BigAutoField(primary_key=True)
    mandate = models.ForeignKey(MandateRecord, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=32)  
    outcome = models.CharField(max_length=16, blank=True)  
    rule_hits = models.JSONField(default=list) 
    payload = models.JSONField(default=dict)  
    resolution = models.CharField(max_length=16, default=NA) 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PayPalOrder(models.Model):
    CREATED, COMPLETED, FAILED = "created", "completed", "failed"

    id = models.BigAutoField(primary_key=True)
    mandate = models.ForeignKey(MandateRecord, on_delete=models.CASCADE, related_name="orders")
    paypal_order_id = models.CharField(max_length=64, unique=True)
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    approve_url = models.URLField(max_length=500)
    status = models.CharField(max_length=16, default=CREATED)
    created_at = models.DateTimeField(auto_now_add=True)
