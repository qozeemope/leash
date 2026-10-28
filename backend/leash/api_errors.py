from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .llm import LLMError, LLMRejected


def _error(code: str, message: str, status: int) -> Response:
    return Response({"error": {"code": code, "message": message, "details": None}}, status=status)


def api_exception_handler(exc, context):
    if isinstance(exc, LLMRejected):
        return _error("ai_rejected", "The AI could not process that request.", 422)
    if isinstance(exc, LLMError):
        return _error("ai_unavailable", "The AI service is unavailable right now. Please try again.", 503)

    response = exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
        message = "The request was not valid."
        details = response.data
    else:
        code = "not_found" if isinstance(exc, Http404) else getattr(exc, "default_code", "error")
        message = response.data.get("detail", "Request failed.") if isinstance(response.data, dict) else "Request failed."
        details = None

    response.data = {"error": {"code": code, "message": str(message), "details": details}}
    return response
