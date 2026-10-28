import logging
import time
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Protocol, Sequence

from django.conf import settings
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)


class LLMError(Exception):
    pass


class LLMUnavailable(LLMError):
    pass


class LLMRejected(LLMError):
    pass


class LLMConfigurationError(LLMError):
    pass


class LLMBudgetExceeded(LLMError):
    pass


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters: dict


@dataclass(frozen=True)
class ToolCall:
    name: str
    arguments: dict


@dataclass(frozen=True)
class ToolResult:
    name: str
    content: dict


@dataclass(frozen=True)
class Message:
    role: str
    text: str = ""
    tool_calls: tuple[ToolCall, ...] = ()
    tool_results: tuple[ToolResult, ...] = ()
    raw: Any = field(default=None, compare=False, repr=False)


@dataclass(frozen=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass(frozen=True)
class LLMResponse:
    message: Message
    usage: Usage = Usage()

    @property
    def text(self) -> str:
        return self.message.text

    @property
    def tool_calls(self) -> tuple[ToolCall, ...]:
        return self.message.tool_calls


class LLMClient(Protocol):
    def complete(
        self,
        *,
        system: str,
        messages: Sequence[Message],
        tools: Sequence[ToolSpec] = (),
        force_tool: str | None = None,
        max_output_tokens: int | None = None,
    ) -> LLMResponse: ...


class RetryingClient:
    def __init__(self, inner: LLMClient, max_retries: int, base_delay: float = 1.0, sleep=time.sleep):
        self._inner = inner
        self._max_retries = max_retries
        self._base_delay = base_delay
        self._sleep = sleep

    def complete(self, **kwargs) -> LLMResponse:
        attempt = 0
        while True:
            try:
                return self._inner.complete(**kwargs)
            except LLMUnavailable:
                if attempt >= self._max_retries:
                    raise
                self._sleep(self._base_delay * 2**attempt)
                attempt += 1


class MeteredClient:
    def __init__(self, inner: LLMClient, daily_token_budget: int):
        self._inner = inner
        self._daily_token_budget = daily_token_budget

    def complete(self, **kwargs) -> LLMResponse:
        from .models import LLMUsage

        today = timezone.now().date()
        row = LLMUsage.objects.filter(day=today).first()
        if row is not None and row.input_tokens + row.output_tokens >= self._daily_token_budget:
            raise LLMBudgetExceeded("The daily AI token budget has been used up.")

        response = self._inner.complete(**kwargs)

        LLMUsage.objects.get_or_create(day=today)
        LLMUsage.objects.filter(day=today).update(
            calls=F("calls") + 1,
            input_tokens=F("input_tokens") + response.usage.input_tokens,
            output_tokens=F("output_tokens") + response.usage.output_tokens,
        )
        return response


@lru_cache(maxsize=1)
def get_client() -> LLMClient:
    if not settings.LLM_API_KEY or not settings.LLM_MODEL:
        raise LLMConfigurationError("LLM_API_KEY and LLM_MODEL must both be set.")
    if settings.LLM_PROVIDER != "gemini":
        raise LLMConfigurationError(f"Unsupported LLM provider: {settings.LLM_PROVIDER}")

    from .llm_gemini import GeminiClient

    provider_client = GeminiClient(
        api_key=settings.LLM_API_KEY,
        model=settings.LLM_MODEL,
        timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
        max_output_tokens=settings.LLM_MAX_OUTPUT_TOKENS,
    )
    metered = MeteredClient(provider_client, settings.LLM_DAILY_TOKEN_BUDGET)
    return RetryingClient(metered, max_retries=settings.LLM_MAX_RETRIES)
