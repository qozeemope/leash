import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from leash import services
from leash.models import PayPalOrder
from leash.policy import CartItem, Mandate, ProposedAction


class Command(BaseCommand):
    help = "Run one real purchase through the PayPal sandbox using the full service layer."

    def handle(self, *args, **options):
        users = get_user_model().objects
        user = users.filter(username="smoke_tester").first() or users.create_user("smoke_tester")

        mandate = Mandate(
            mandate_id=str(uuid.uuid4()),
            currency="USD",
            budget_cents=6000,
            expires_at=timezone.now() + timedelta(hours=1),
            allowed_categories=("socks",),
            per_item_cap_cents=3000,
            min_merchant_rating=4.0,
            max_delivery_days=3,
        )
        record = services.create_signed_mandate(user, "sandbox smoke test", mandate)
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

        result = services.submit_proposal(record, action, {"kind": "checkout", "source": "smoke"})
        self.stdout.write(f"Decision: {result['outcome']}")
        if result["outcome"] != "approve":
            self.stdout.write(f"Reasons: {result['reasons']}")
            return

        self.stdout.write(f"PayPal order: {result['paypal_order_id']}")
        self.stdout.write("Open this link in a private window and approve as the sandbox BUYER:")
        self.stdout.write(result["approve_url"])
        input("Press Enter once you have approved the payment... ")

        order = PayPalOrder.objects.get(paypal_order_id=result["paypal_order_id"])
        order = services.capture_order(order)
        self.stdout.write(f"Order status: {order.status}")
        self.stdout.write(f"Budget committed: {record.spent_cents()} of {mandate.budget_cents} cents")
