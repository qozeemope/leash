from django.db import OperationalError, connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health(request):
    try:
        connection.ensure_connection()
    except OperationalError:
        return Response({"status": "unavailable"}, status=503)
    return Response({"status": "ok"})
