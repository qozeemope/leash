from django.urls import path

from . import auth_views, views
from .health import health

urlpatterns = [
    path("health/", health),
    path("auth/csrf/", auth_views.csrf),
    path("auth/login/", auth_views.login_view),
    path("auth/logout/", auth_views.logout_view),
    path("auth/me/", auth_views.me),
    path("auth/demo/", auth_views.demo),
    path("mandates/", views.MandateListCreateView.as_view()),
    path("mandates/parse/", views.parse_mandate),
    path("mandates/<uuid:mandate_id>/", views.MandateDetailView.as_view()),
    path("mandates/<uuid:mandate_id>/propose/", views.propose),
    path("mandates/<uuid:mandate_id>/audit/", views.AuditLogView.as_view()),
    path("mandates/<uuid:mandate_id>/agent-runs/", views.start_agent_run),
    path("agent-runs/<uuid:run_id>/", views.agent_run_detail),
    path("audit/<int:event_id>/resolve/", views.resolve_escalation),
    path("orders/<str:paypal_order_id>/capture/", views.capture),
]
