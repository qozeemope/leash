from django.urls import path

from . import views
from .health import health

urlpatterns = [
    path("health/", health),
    path("mandates/", views.MandateListCreateView.as_view()),
    path("mandates/<uuid:mandate_id>/", views.MandateDetailView.as_view()),
    path("mandates/<uuid:mandate_id>/propose/", views.propose),
    path("mandates/<uuid:mandate_id>/audit/", views.AuditLogView.as_view()),
    path("audit/<int:event_id>/resolve/", views.resolve_escalation),
    path("orders/<str:paypal_order_id>/capture/", views.capture),
]
