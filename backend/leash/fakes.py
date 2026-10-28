from typing import Sequence

from .llm import LLMResponse, Message, ToolCall, ToolSpec, Usage


def text_response(text: str, usage: Usage = Usage(10, 5)) -> LLMResponse:
    return LLMResponse(message=Message(role="assistant", text=text), usage=usage)


def tool_response(name: str, arguments: dict, usage: Usage = Usage(10, 5)) -> LLMResponse:
    message = Message(role="assistant", tool_calls=(ToolCall(name=name, arguments=arguments),))
    return LLMResponse(message=message, usage=usage)


class FakeLLM:
    def __init__(self, *script):
        self._script = list(script)
        self.calls: list[dict] = []

    def complete(
        self,
        *,
        system: str,
        messages: Sequence[Message],
        tools: Sequence[ToolSpec] = (),
        force_tool: str | None = None,
        max_output_tokens: int | None = None,
    ) -> LLMResponse:
        self.calls.append(
            {"system": system, "messages": list(messages), "tools": list(tools), "force_tool": force_tool}
        )
        if not self._script:
            raise AssertionError("FakeLLM was called more times than scripted.")
        item = self._script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item
