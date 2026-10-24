from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from leash.accounts import DEMO_PREFIX


class Command(BaseCommand):
    help = "Delete demo accounts, and everything they own, older than the given age."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=24)

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options["hours"])
        stale = get_user_model().objects.filter(
            username__startswith=DEMO_PREFIX,
            date_joined__lt=cutoff,
            is_staff=False,
            is_superuser=False,
        )
        count = stale.count()
        stale.delete()
        self.stdout.write(f"Deleted {count} demo accounts.")
