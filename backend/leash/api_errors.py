from django.http import Http404
from rest_framework import exceptions
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
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
