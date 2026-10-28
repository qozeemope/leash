from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from leash import llm
from leash.llm import LLMError, Message, ToolResult, ToolSpec
from leash.models import LLMUsage

SET_BUDGET = ToolSpec(
    name="set_budget",
    description="Record the user's spending limit.",
    parameters={
        "type": "object",
        "properties": {"amount_cents": {"type": "integer", "description": "The limit in US cents."}},
        "required": ["amount_cents"],
    },
)

GET_PRICE = ToolSpec(
    name="get_price",
    description="Look up the price of a product.",
    parameters={
        "type": "object",
        "properties": {"item": {"type": "string", "description": "The product name."}},
        "required": ["item"],
    },
)


class Command(BaseCommand):
    help = "Checks the real AI provider: plain text, a forced tool call, and a tool round trip."

    def handle(self, *args, **options):
        try:
            client = llm.get_client()
            self.check_text(client)
            self.check_forced_tool(client)
            self.check_round_trip(client)
        except LLMError as exc:
            raise CommandError(f"{type(exc).__name__}: {exc}") from exc

        usage = LLMUsage.objects.filter(day=timezone.now().date()).first()
        if usage:
            self.stdout.write(
                f"Today so far: {usage.calls} calls, {usage.input_tokens} input and {usage.output_tokens} output tokens."
            )

    def check_text(self, client):
        response = client.complete(
            system="You are terse.",
            messages=[Message(role="user", text="Reply with exactly one word: ready")],
        )
        self.stdout.write(f"1. Plain text: {response.text.strip()!r}")

    def check_forced_tool(self, client):
        response = client.complete(
            system="Extract the spending limit from the user's message.",
            messages=[Message(role="user", text="I want to spend at most $42.50 on socks")],
            tools=[SET_BUDGET],
            force_tool="set_budget",
        )
        if not response.tool_calls:
            raise CommandError("2. Forced tool call returned no tool call.")
        arguments = response.tool_calls[0].arguments
        verdict = "correct" if arguments.get("amount_cents") == 4250 else "UNEXPECTED, expected 4250"
        self.stdout.write(f"2. Forced tool call: {arguments} ({verdict})")

    def check_round_trip(self, client):
        history = [Message(role="user", text="How much do trail running socks cost? Use the tool.")]
        first = client.complete(system="Answer using the tools.", messages=history, tools=[GET_PRICE])
        if not first.tool_calls:
            raise CommandError("3. The model did not call the tool.")
        call = first.tool_calls[0]
        self.stdout.write(f"3. Model asked for: {call.name} {call.arguments}")

        history.append(first.message)
        history.append(Message(role="user", tool_results=(ToolResult(call.name, {"price_cents": 1800}),)))
        second = client.complete(system="Answer using the tools.", messages=history, tools=[GET_PRICE])
        self.stdout.write(f"   Final answer: {second.text.strip()!r}")
