import logging
from typing import Sequence

from .llm import (
    LLMConfigurationError,
    LLMRejected,
    LLMResponse,
    LLMUnavailable,
    Message,
    ToolCall,
    ToolSpec,
    Usage,
)

logger = logging.getLogger(__name__)


def to_content(message: Message, types):
    if message.raw is not None:
        return message.raw
    parts = []
    if message.text:
        parts.append(types.Part.from_text(text=message.text))
    for call in message.tool_calls:
        parts.append(types.Part.from_function_call(name=call.name, args=call.arguments))
    for result in message.tool_results:
        parts.append(types.Part.from_function_response(name=result.name, response=result.content))
    return types.Content(role="model" if message.role == "assistant" else "user", parts=parts)


def from_response(response) -> LLMResponse:
    candidates = response.candidates or []
    if not candidates or candidates[0].content is None:
        feedback = getattr(response, "prompt_feedback", None)
        reason = getattr(feedback, "block_reason", None) or "no content returned"
        raise LLMRejected(f"The model returned no usable answer ({reason}).")

    content = candidates[0].content
    parts = content.parts or []
    text = "".join(p.text for p in parts if getattr(p, "text", None) and not getattr(p, "thought", False))
    calls = tuple(
        ToolCall(name=p.function_call.name, arguments=dict(p.function_call.args or {}))
        for p in parts
        if getattr(p, "function_call", None)
    )
    meta = getattr(response, "usage_metadata", None)
    usage = Usage(
        input_tokens=getattr(meta, "prompt_token_count", 0) or 0,
        output_tokens=(getattr(meta, "candidates_token_count", 0) or 0)
        + (getattr(meta, "thoughts_token_count", 0) or 0),
    )
    message = Message(role="assistant", text=text, tool_calls=calls, raw=content)
    return LLMResponse(message=message, usage=usage)


class GeminiClient:
    def __init__(self, api_key: str, model: str, timeout_seconds: float, max_output_tokens: int):
        from google import genai
        from google.genai import errors, types

        self._types = types
        self._errors = errors
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
        )
        self._model = model
        self._max_output_tokens = max_output_tokens

    def complete(
        self,
        *,
        system: str,
        messages: Sequence[Message],
        tools: Sequence[ToolSpec] = (),
        force_tool: str | None = None,
        max_output_tokens: int | None = None,
    ) -> LLMResponse:
        import httpx

        types = self._types
        config_args = {
            "system_instruction": system,
            "max_output_tokens": min(max_output_tokens or self._max_output_tokens, self._max_output_tokens),
            "automatic_function_calling": types.AutomaticFunctionCallingConfig(disable=True),
        }
        if tools:
            declarations = [
                {"name": t.name, "description": t.description, "parameters": t.parameters} for t in tools
            ]
            config_args["tools"] = [types.Tool(function_declarations=declarations)]
            if force_tool:
                config_args["tool_config"] = types.ToolConfig(
                    function_calling_config=types.FunctionCallingConfig(
                        mode="ANY", allowed_function_names=[force_tool]
                    )
                )

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=[to_content(m, types) for m in messages],
                config=types.GenerateContentConfig(**config_args),
            )
        except self._errors.APIError as exc:
            code = getattr(exc, "code", None) or 0
            logger.warning("Gemini request failed with status %s: %s", code, getattr(exc, "message", exc))
            if code in (401, 403):
                raise LLMConfigurationError("The AI provider rejected the API key.") from exc
            if code == 429 or code >= 500:
                raise LLMUnavailable("The AI provider is busy or unavailable.") from exc
            raise LLMRejected("The AI provider rejected the request.") from exc
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            logger.warning("Gemini request failed: %r", exc)
            raise LLMUnavailable("The AI provider could not be reached.") from exc

        return from_response(response)
