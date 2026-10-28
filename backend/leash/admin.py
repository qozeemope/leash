from django import forms
from django.conf import settings
from django.contrib import admin

from .models import AuditEvent, LLMUsage, MandateRecord, PayPalOrder
from .policy import Mandate, sign_mandate


class MandateRecordForm(forms.ModelForm):
    class Meta:
        model = MandateRecord
        fields = ("owner", "raw_text", "terms")

    def clean_terms(self):
        terms = self.cleaned_data["terms"]
        try:
            Mandate.from_dict({"mandate_id": "pending", **terms})
        except (KeyError, TypeError, ValueError) as exc:
            raise forms.ValidationError(f"Invalid mandate terms: {exc}")
        return terms


@admin.register(MandateRecord)
class MandateRecordAdmin(admin.ModelAdmin):
    form = MandateRecordForm
    list_display = ("short_id", "owner", "created_at")
    search_fields = ("raw_text", "owner__username")
    fields = ("owner", "raw_text", "terms", "signature", "created_at")
    readonly_fields = ("signature", "created_at")

    @admin.display(description="Mandate")
    def short_id(self, obj):
        return str(obj.id)[:8]

    def save_model(self, request, obj, form, change):
        mandate = Mandate.from_dict({**obj.terms, "mandate_id": str(obj.id)})
        obj.terms = mandate.to_dict()
        obj.signature = sign_mandate(mandate, settings.MANDATE_SIGNING_KEY.encode())
        super().save_model(request, obj, form, change)


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AuditEvent)
class AuditEventAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "mandate", "kind", "outcome", "resolution")
    list_filter = ("kind", "outcome", "resolution")


@admin.register(PayPalOrder)
class PayPalOrderAdmin(ReadOnlyAdmin):
    list_display = ("paypal_order_id", "mandate", "amount_cents", "currency", "status", "created_at")
    list_filter = ("status",)


@admin.register(LLMUsage)
class LLMUsageAdmin(ReadOnlyAdmin):
    list_display = ("day", "calls", "input_tokens", "output_tokens")
