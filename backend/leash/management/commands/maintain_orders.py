from django.core.management.base import BaseCommand

from leash import services


class Command(BaseCommand):
    help = "Expire abandoned orders and settle orders stuck mid-capture."

    def handle(self, *args, **options):
        expired = services.expire_stale_orders()
        reconciled = services.reconcile_capturing()
        self.stdout.write(f"Expired orders: {expired}")
        self.stdout.write(
            "Capturing orders: "
            f"{reconciled['completed']} completed, "
            f"{reconciled['released']} released, "
            f"{reconciled['unchanged']} unchanged"
        )
