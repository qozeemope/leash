from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .accounts import is_demo
from .models import AuditEvent, MandateRecord, PayPalOrder
from .policy import CartItem, Outcome, ProposedAction

MAX_CENTS = 10_000_000


class MandateTermsSerializer(serializers.Serializer):
    currency = serializers.RegexField(r"^[A-Za-z]{3}$")
    budget_cents = serializers.IntegerField(min_value=1, max_value=MAX_CENTS)
    expires_at = serializers.DateTimeField()
    allowed_categories = serializers.ListField(
        child=serializers.CharField(max_length=64), min_length=1, max_length=20
    )
    per_item_cap_cents = serializers.IntegerField(min_value=1, max_value=MAX_CENTS)
    max_items = serializers.IntegerField(min_value=1, max_value=50, default=5)
    min_merchant_rating = serializers.FloatField(min_value=0, max_value=5, default=0)
    max_delivery_days = serializers.IntegerField(min_value=0, max_value=365, allow_null=True, default=None)
    escalate_over_cents = serializers.IntegerField(
        min_value=1, max_value=MAX_CENTS, allow_null=True, default=None
    )
    blocked_merchants = serializers.ListField(
        child=serializers.CharField(max_length=128), max_length=100, default=list
    )

    def validate_expires_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Expiry must be in the future.")
        return value

    def validate(self, attrs):
        if attrs["per_item_cap_cents"] > attrs["budget_cents"]:
            raise serializers.ValidationError("per_item_cap_cents cannot exceed budget_cents.")
        escalate = attrs["escalate_over_cents"]
        if escalate is not None and escalate > attrs["budget_cents"]:
            raise serializers.ValidationError("escalate_over_cents cannot exceed budget_cents.")
        return attrs


class MandateCreateSerializer(serializers.Serializer):
    raw_text = serializers.CharField(max_length=2000, allow_blank=True, default="")
    terms = MandateTermsSerializer()


class CartItemSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    category = serializers.CharField(max_length=64)
    unit_price_cents = serializers.IntegerField(min_value=1, max_value=MAX_CENTS)
    quantity = serializers.IntegerField(min_value=1, max_value=100, default=1)
    merchant = serializers.CharField(max_length=128, default="unknown")
    merchant_rating = serializers.FloatField(min_value=0, max_value=5, allow_null=True, default=None)
    delivery_days = serializers.IntegerField(min_value=0, max_value=365, allow_null=True, default=None)


class ProposalSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["add_to_cart", "checkout"])
    items = CartItemSerializer(many=True, allow_empty=False, max_length=50)
    currency = serializers.RegexField(r"^[A-Za-z]{3}$", default="USD")
    origin = serializers.ChoiceField(choices=["agent", "untrusted_content"], default="agent")
    agent_reason = serializers.CharField(max_length=1000, allow_blank=True, default="")

    def to_action(self) -> ProposedAction:
        data = self.validated_data
        return ProposedAction(
            kind=data["kind"],
            items=tuple(CartItem(**item) for item in data["items"]),
            currency=data["currency"].upper(),
            origin=data["origin"],
            agent_reason=data["agent_reason"],
        )


class ResolveSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "deny"])


class MandateSerializer(serializers.ModelSerializer):
    spent_cents = serializers.SerializerMethodField()

    class Meta:
        model = MandateRecord
        fields = ["id", "raw_text", "terms", "spent_cents", "created_at"]
        read_only_fields = ["id", "raw_text", "terms", "created_at"]

    @extend_schema_field(serializers.IntegerField())
    def get_spent_cents(self, obj):
        return obj.spent_cents()


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = ["id", "created_at", "kind", "outcome", "rule_hits", "payload", "resolution"]
        read_only_fields = fields


class ProposalResponseSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=[o.value for o in Outcome])
    reasons = serializers.ListField(child=serializers.CharField(), required=False)
    event_id = serializers.IntegerField()
    paypal_order_id = serializers.CharField(required=False)
    approve_url = serializers.URLField(required=False)


class ResolveResponseSerializer(serializers.Serializer):
    resolution = serializers.ChoiceField(choices=[AuditEvent.APPROVED, AuditEvent.DENIED])
    reasons = serializers.ListField(child=serializers.CharField(), required=False)
    paypal_order_id = serializers.CharField(required=False)
    approve_url = serializers.URLField(required=False)


class CaptureResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[value for value, _ in PayPalOrder.STATUSES])


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    is_demo = serializers.SerializerMethodField()

    @extend_schema_field(serializers.BooleanField())
    def get_is_demo(self, obj):
        return is_demo(obj)


class HealthResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok", "unavailable"])