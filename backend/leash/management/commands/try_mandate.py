import json

from django.core.management.base import BaseCommand, CommandError

from leash import mandate_parser
from leash.llm import LLMError


class Command(BaseCommand):
    help = "Parses a plain-English spending rule with the real AI and prints the result."

    def add_arguments(self, parser):
        parser.add_argument("text")

    def handle(self, *args, **options):
        try:
            parsed = mandate_parser.parse_mandate(options["text"])
        except LLMError as exc:
            raise CommandError(f"{type(exc).__name__}: {exc}") from exc

        self.stdout.write(f"Status: {parsed.status}")
        for line in parsed.summary:
            self.stdout.write(f"  - {line}")
        for line in parsed.assumptions:
            self.stdout.write(f"  Assumption: {line}")
        for line in parsed.questions:
            self.stdout.write(f"  Question: {line}")
        if parsed.terms:
            self.stdout.write(json.dumps(parsed.terms, indent=2))
