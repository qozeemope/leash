import uuid

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from leash import agent, mandate_parser, services
from leash.llm import LLMError
from leash.models import AgentRun
from leash.policy import Mandate


class Command(BaseCommand):
    help = "Runs the whole pipeline with the real AI: parse a mandate, then let the agent shop."

    def add_arguments(self, parser):
        parser.add_argument("--mandate", required=True, help="Spending rules in plain English.")
        parser.add_argument("--request", required=True, help="What to shop for.")
        parser.add_argument("--red-team", action="store_true", help="Let the AI see suspicious product text.")

    def handle(self, *args, **options):
        try:
            parsed = mandate_parser.parse_mandate(options["mandate"])
        except LLMError as exc:
            raise CommandError(f"{type(exc).__name__}: {exc}") from exc
        if parsed.status != "ready":
            raise CommandError("The mandate needs more detail: " + " ".join(parsed.questions))

        user, _ = get_user_model().objects.get_or_create(username="agent_demo")
        mandate = Mandate.from_dict({**parsed.terms, "mandate_id": str(uuid.uuid4())})
        record = services.create_signed_mandate(user, options["mandate"], mandate)
        self.stdout.write("Mandate:")
        for line in parsed.summary:
            self.stdout.write(f"  - {line}")

        run = AgentRun.objects.create(mandate=record, request_text=options["request"])
        mode = "red-team (AI sees suspicious text)" if options["red_team"] else "normal"
        self.stdout.write(f"\nRunning agent in {mode} mode...\n")
        agent.execute_run(run.id, pass_raw=options["red_team"])

        run.refresh_from_db()
        for step in run.steps.all():
            self.stdout.write(self.describe(step))
        self.stdout.write(f"\nStatus: {run.status}   Tainted: {run.tainted}")
        self.stdout.write(f"Final message: {run.final_message}")

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
