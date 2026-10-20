from django.db import OperationalError, connection
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import HealthResponseSerializer


@extend_schema(responses={200: HealthResponseSerializer, 503: HealthResponseSerializer})
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        connection.ensure_connection()
    except OperationalError:
        return Response({"status": "unavailable"}, status=503)
    return Response({"status": "ok"})