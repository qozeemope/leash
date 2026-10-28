from importlib.util import find_spec
from types import SimpleNamespace
from unittest import skipUnless

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from . import llm
from .api_errors import api_exception_handler
from .fakes import FakeLLM, text_response
from .llm import (
    LLMBudgetExceeded,
    LLMConfigurationError,
    LLMRejected,
    LLMUnavailable,
    MeteredClient,
    Message,
    RetryingClient,
    ToolCall,
    ToolResult,
    Usage,
)
from .llm_gemini import from_response, to_content
from .models import LLMUsage


def sdk_installed() -> bool:
    try:
        return find_spec("google.genai") is not None
    except ModuleNotFoundError:
        return False


class RetryingClientTests(SimpleTestCase):
    def test_retries_transient_failures_with_growing_delays(self):
        fake = FakeLLM(LLMUnavailable("busy"), LLMUnavailable("busy"), text_response("ok"))
        sleeps = []
        client = RetryingClient(fake, max_retries=2, base_delay=1.0, sleep=sleeps.append)
        response = client.complete(system="s", messages=[])
        self.assertEqual(response.text, "ok")
        self.assertEqual(sleeps, [1.0, 2.0])

    def test_gives_up_after_the_retry_limit(self):
        fake = FakeLLM(*[LLMUnavailable("busy")] * 3)
        client = RetryingClient(fake, max_retries=2, sleep=lambda _: None)
        with self.assertRaises(LLMUnavailable):
            client.complete(system="s", messages=[])
        self.assertEqual(len(fake.calls), 3)

    def test_rejections_are_not_retried(self):
        fake = FakeLLM(LLMRejected("no"))
        client = RetryingClient(fake, max_retries=2, sleep=lambda _: None)
        with self.assertRaises(LLMRejected):
            client.complete(system="s", messages=[])
        self.assertEqual(len(fake.calls), 1)


class MeteredClientTests(TestCase):
    def test_usage_is_recorded_and_accumulates(self):
        fake = FakeLLM(text_response("a", Usage(100, 20)), text_response("b", Usage(50, 10)))
        client = MeteredClient(fake, daily_token_budget=10_000)
        client.complete(system="s", messages=[])
        client.complete(system="s", messages=[])
        row = LLMUsage.objects.get()
        self.assertEqual((row.calls, row.input_tokens, row.output_tokens), (2, 150, 30))

    def test_calls_are_refused_once_the_daily_budget_is_spent(self):
        LLMUsage.objects.create(day=timezone.now().date(), input_tokens=900, output_tokens=200)
        fake = FakeLLM()
        client = MeteredClient(fake, daily_token_budget=1000)
        with self.assertRaises(LLMBudgetExceeded):
            client.complete(system="s", messages=[])
        self.assertEqual(fake.calls, [])


class ErrorMappingTests(SimpleTestCase):
    def test_unavailable_and_budget_errors_become_503(self):
        for error in (LLMUnavailable("x"), LLMBudgetExceeded("x"), LLMConfigurationError("x")):
            response = api_exception_handler(error, {})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.data["error"]["code"], "ai_unavailable")

    def test_rejections_become_422(self):
        response = api_exception_handler(LLMRejected("x"), {})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.data["error"]["code"], "ai_rejected")

    def test_internal_details_are_not_leaked(self):
        response = api_exception_handler(LLMUnavailable("secret internal detail"), {})
        self.assertNotIn("secret", str(response.data))


class GeminiConversionTests(SimpleTestCase):
    def response(self, parts, meta=None):
        candidate = SimpleNamespace(content=SimpleNamespace(parts=parts))
        return SimpleNamespace(candidates=[candidate], usage_metadata=meta)

    def test_text_tool_calls_and_usage_are_extracted(self):
        parts = [
            SimpleNamespace(text="hello", function_call=None, thought=False),
            SimpleNamespace(
                text=None,
                function_call=SimpleNamespace(name="set_budget", args={"amount_cents": 4250}),
                thought=False,
            ),
        ]
        meta = SimpleNamespace(prompt_token_count=12, candidates_token_count=7, thoughts_token_count=3)
        result = from_response(self.response(parts, meta))
        self.assertEqual(result.text, "hello")
        self.assertEqual(result.tool_calls, (ToolCall("set_budget", {"amount_cents": 4250}),))
        self.assertEqual((result.usage.input_tokens, result.usage.output_tokens), (12, 10))

    def test_the_providers_own_reply_object_is_kept_for_the_next_turn(self):
        response = self.response([SimpleNamespace(text="hi", function_call=None, thought=False)])
        result = from_response(response)
        self.assertIs(result.message.raw, response.candidates[0].content)

    def test_thought_summaries_are_excluded_from_the_answer(self):
        parts = [
            SimpleNamespace(text="thinking...", function_call=None, thought=True),
            SimpleNamespace(text="answer", function_call=None, thought=False),
        ]
        self.assertEqual(from_response(self.response(parts)).text, "answer")

    def test_empty_replies_are_rejected(self):
        response = SimpleNamespace(candidates=[], prompt_feedback=SimpleNamespace(block_reason="SAFETY"))
        with self.assertRaises(LLMRejected):
            from_response(response)

    def test_stored_provider_content_is_sent_back_unchanged(self):
        message = Message(role="assistant", raw="RAW-CONTENT")
        self.assertEqual(to_content(message, types=None), "RAW-CONTENT")

    @skipUnless(sdk_installed(), "google-genai is not installed")
    def test_messages_convert_to_sdk_content(self):
        from google.genai import types

        user = to_content(Message(role="user", text="hi"), types)
        self.assertEqual(user.role, "user")
        self.assertEqual(user.parts[0].text, "hi")

        result = Message(role="user", tool_results=(ToolResult("get_price", {"price_cents": 1800}),))
        self.assertEqual(to_content(result, types).parts[0].function_response.name, "get_price")


class GetClientTests(SimpleTestCase):
    def setUp(self):
        llm.get_client.cache_clear()
        self.addCleanup(llm.get_client.cache_clear)

    @override_settings(LLM_API_KEY="", LLM_MODEL="some-model")
    def test_missing_key_is_a_configuration_error(self):
        with self.assertRaises(LLMConfigurationError):
            llm.get_client()

    @override_settings(LLM_API_KEY="key", LLM_MODEL="some-model", LLM_PROVIDER="other")
    def test_unknown_provider_is_a_configuration_error(self):
        with self.assertRaises(LLMConfigurationError):
            llm.get_client()
