import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from rest_framework.exceptions import APIException

from leash import paypal, services
from leash.models import PayPalOrder
from leash.policy import CartItem, Mandate, ProposedAction


class Command(BaseCommand):
    help = "Runs one real purchase against the PayPal sandbox through the services layer."

    def handle(self, *args, **options):
        if "sandbox" not in settings.PAYPAL_BASE_URL:
            raise CommandError("Refusing to run: PAYPAL_BASE_URL is not the sandbox.")

        user, _ = get_user_model().objects.get_or_create(username="smoke_test")
        mandate = Mandate(
            mandate_id=str(uuid.uuid4()),
            currency="USD",
            budget_cents=6000,
            expires_at=timezone.now() + timedelta(days=1),
            allowed_categories=("socks",),
            per_item_cap_cents=3000,
        )
        record = services.create_signed_mandate(user, "smoke test", mandate)
        item = CartItem(
            title="Trail running socks",
            category="socks",
            unit_price_cents=1800,
            quantity=1,
            merchant="RunCo",
            merchant_rating=4.6,
            delivery_days=2,
        )
        action = ProposedAction(kind="checkout", items=(item,))

        result = services.submit_proposal(record, action, {"kind": "checkout"})
        self.stdout.write(f"Decision: {result['outcome']}")
        if result["outcome"] != "approve":
            raise CommandError(f"Expected approval, got: {result}")

        order = PayPalOrder.objects.get(paypal_order_id=result["paypal_order_id"])
        self.stdout.write(f"Order {order.paypal_order_id} status: {order.status}")

        self.stdout.write("Trying to capture before the buyer approves (this should be refused)...")
        try:
            services.capture_order(order)
            self.stdout.write(self.style.WARNING("Capture unexpectedly succeeded."))
        except APIException as exc:
            self.stdout.write(f"Refused as expected: {exc.default_code}")

        self.stdout.write("")
        self.stdout.write("Open this link in a private window and approve as the sandbox BUYER:")
        self.stdout.write(result["approve_url"])
        self.stdout.write("The browser will fail to load localhost afterwards. That is expected.")
        input("Press Enter once you have approved the payment...")

        while True:
            remote = paypal.get_order(order.paypal_order_id)
            self.stdout.write(f"PayPal reports the order status as: {remote['status']}")
            if remote["status"] == "APPROVED":
                break
            self.stdout.write("The buyer has not finished approving. Complete 'Pay Now' in the PayPal window.")
            input("Press Enter to check again (Ctrl+C to quit)...")

        order = services.capture_order(order)
        self.stdout.write(self.style.SUCCESS(f"Final order status: {order.status}"))
        self.stdout.write(f"Budget committed: {record.spent_cents()} cents")
        for event in record.events.order_by("created_at"):
            self.stdout.write(f"  {event.kind} {event.outcome}")
