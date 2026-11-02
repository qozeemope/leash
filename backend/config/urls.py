from django.conf import settings
from django.contrib import admin
from django.http import Http404, HttpResponse
from django.urls import include, path, re_path
from django.views.decorators.http import require_safe
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


@require_safe
def spa(request):
    index = settings.FRONTEND_DIST / "index.html"
    try:
        html = index.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise Http404("The frontend has not been built.")
    response = HttpResponse(html, content_type="text/html")
    response["Cache-Control"] = "no-cache"
    return response


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("api/", include("leash.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", spa),
]
