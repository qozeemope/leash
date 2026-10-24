import secrets

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.middleware.csrf import get_token
from drf_spectacular.utils import extend_schema
from rest_framework import exceptions, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .accounts import DEMO_PREFIX
from .serializers import DetailSerializer, LoginSerializer, UserSerializer
from .throttles import DemoThrottle, LoginThrottle


def _enforce_csrf(request):
    SessionAuthentication().enforce_csrf(request)


@extend_schema(responses=DetailSerializer)
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    get_token(request)
    return Response({"detail": "CSRF cookie set."})


@extend_schema(request=LoginSerializer, responses=UserSerializer)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    _enforce_csrf(request)
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(request._request, **serializer.validated_data)
    if user is None:
        raise exceptions.AuthenticationFailed("Invalid username or password.")
    login(request._request, user)
    return Response(UserSerializer(user).data)


@extend_schema(request=None, responses={204: None})
@api_view(["POST"])
def logout_view(request):
    logout(request._request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(responses=UserSerializer)
@api_view(["GET"])
def me(request):
    return Response(UserSerializer(request.user).data)


@extend_schema(request=None, responses={201: UserSerializer})
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([DemoThrottle])
def demo(request):
    if not settings.DEMO_MODE:
        raise exceptions.NotFound()
    _enforce_csrf(request)
    user = get_user_model().objects.create_user(f"{DEMO_PREFIX}{secrets.token_hex(6)}", password=None)
    login(request._request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
