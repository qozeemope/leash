import uuid

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import services
from .models import AuditEvent, MandateRecord, PayPalOrder
from .policy import Outcome
from .serializers import (
    AuditEventSerializer,
    CaptureResponseSerializer,
    MandateCreateSerializer,
    MandateSerializer,
    ProposalResponseSerializer,
    ProposalSerializer,
    ResolveResponseSerializer,
    ResolveSerializer,
)


class MandateListCreateView(generics.ListCreateAPIView):
    serializer_class = MandateSerializer

    def get_queryset(self):
        return MandateRecord.objects.filter(owner=self.request.user)

    @extend_schema(request=MandateCreateSerializer, responses={201: MandateSerializer})
    def post(self, request, *args, **kwargs):
        serializer = MandateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        mandate = services.build_mandate(data["terms"], uuid.uuid4())
        record = services.create_signed_mandate(request.user, data["raw_text"], mandate)
        return Response(MandateSerializer(record).data, status=status.HTTP_201_CREATED)


class MandateDetailView(generics.RetrieveAPIView):
    serializer_class = MandateSerializer
    lookup_url_kwarg = "mandate_id"

    def get_queryset(self):
        return MandateRecord.objects.filter(owner=self.request.user)


class AuditLogView(generics.ListAPIView):
    serializer_class = AuditEventSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditEvent.objects.none()
        record = get_object_or_404(MandateRecord, pk=self.kwargs["mandate_id"], owner=self.request.user)
        return record.events.all()


@extend_schema(request=ProposalSerializer, responses=ProposalResponseSerializer)
@api_view(["POST"])
def propose(request, mandate_id):
    record = get_object_or_404(MandateRecord, pk=mandate_id, owner=request.user)
    serializer = ProposalSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = services.submit_proposal(record, serializer.to_action(), dict(serializer.data))
    return Response(result)


@extend_schema(request=ResolveSerializer, responses=ResolveResponseSerializer)
@api_view(["POST"])
def resolve_escalation(request, event_id):
    event = get_object_or_404(
        AuditEvent.objects.select_related("mandate"),
        pk=event_id,
        mandate__owner=request.user,
        outcome=Outcome.ESCALATE.value,
        resolution=AuditEvent.OPEN,
    )
    serializer = ResolveSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(services.resolve_escalation(event, serializer.validated_data["decision"]))


@extend_schema(request=None, responses=CaptureResponseSerializer)
@api_view(["POST"])
def capture(request, paypal_order_id):
    order = get_object_or_404(
        PayPalOrder.objects.select_related("mandate"),
        paypal_order_id=paypal_order_id,
        mandate__owner=request.user,
    )
    order = services.capture_order(order)
    return Response({"status": order.status})
