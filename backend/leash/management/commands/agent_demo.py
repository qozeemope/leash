import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from leash import agent, mandate_parser, services
from leash.llm import LLMError
from leash.models import AgentRun
from leash.policy import Mandate

SIMULATIONS = {
    "gift_card": AgentRun.ATTACK_GIFT_CARD,
    "overspend": AgentRun.ATTACK_OVERSPEND,
    "banned_merchant": AgentRun.ATTACK_BANNED_MERCHANT,
}


class Command(BaseCommand):
    help = "Runs the whole pipeline: a mandate, then the agent shopping (live or as a simulated attack)."

    def add_arguments(self, parser):
        parser.add_argument("--mandate", help="Spending rules in plain English.")
        parser.add_argument("--request", default="Find me some good running socks")
        parser.add_argument("--red-team", action="store_true", help="Let the real AI see suspicious product text.")
        parser.add_argument("--simulate", choices=sorted(SIMULATIONS), help="Replay a scripted compromised agent.")

    def handle(self, *args, **options):
        user, _ = get_user_model().objects.get_or_create(username="agent_demo")
        if options["mandate"]:
            record, summary = self.parsed_mandate(user, options["mandate"])
        elif options["simulate"]:
            record, summary = self.default_mandate(user)
        else:
            raise CommandError("Provide --mandate, or use --simulate for a built-in one.")

        self.stdout.write("Mandate:")
        for line in summary:
            self.stdout.write(f"  - {line}")

        mode = SIMULATIONS[options["simulate"]] if options["simulate"] else AgentRun.LIVE
        run = AgentRun.objects.create(mandate=record, request_text=options["request"], mode=mode)
        label = "simulated attack" if options["simulate"] else ("red-team" if options["red_team"] else "normal")
        self.stdout.write(f"\nRunning agent ({label} mode)...\n")
        agent.execute_run(run.id, pass_raw=options["red_team"])

        run.refresh_from_db()
        for step in run.steps.all():
            self.stdout.write(self.describe(step))
        self.stdout.write(f"\nStatus: {run.status}   Tainted: {run.tainted}")
        self.stdout.write(f"Final message: {run.final_message}")

    def parsed_mandate(self, user, text):
        try:
            parsed = mandate_parser.parse_mandate(text)
        except LLMError as exc:
            raise CommandError(f"{type(exc).__name__}: {exc}") from exc
        if parsed.status != "ready":
            raise CommandError("The mandate needs more detail: " + " ".join(parsed.questions))
        mandate = Mandate.from_dict({**parsed.terms, "mandate_id": str(uuid.uuid4())})
        return services.create_signed_mandate(user, text, mandate), parsed.summary

    def default_mandate(self, user):
        mandate = Mandate(
            mandate_id=str(uuid.uuid4()),
            currency="USD",
            budget_cents=6000,
            expires_at=timezone.now() + timedelta(days=1),
            allowed_categories=("socks",),
            per_item_cap_cents=3000,
            max_items=3,
            min_merchant_rating=4.0,
            max_delivery_days=3,
            blocked_merchants=("SketchyShop",),
        )
        summary = mandate_parser.describe(mandate.to_dict())
        return services.create_signed_mandate(user, "built-in demo mandate", mandate), summary

    def describe(self, step):
        data = step.data
        if step.kind == "search":
            return f"[search] {data['query']!r} -> {data['count']} products {data['product_ids']}"
        if step.kind == "injection_flag":
            action = "withheld from the AI" if data["withheld"] else "SHOWN to the AI"
            return f"[injection] {data['title']} ({data['product_id']}): {action}"
        if step.kind == "proposal":
            titles = ", ".join(f"{i['quantity']}x {i['title']}" for i in data["items"])
            line = f"[proposal] {titles} -> {data['outcome'].upper()} (origin: {data['origin']})"
            for reason in data["reasons"]:
                line += f"\n      - {reason}"
            if data.get("approve_url"):
                line += f"\n      Approve on PayPal: {data['approve_url']}"
            return line
        if step.kind == "error":
            return f"[error] {data['message']}"
        return f"[{step.kind}]"
