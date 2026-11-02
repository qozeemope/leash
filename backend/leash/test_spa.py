import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings


class SinglePageAppTests(SimpleTestCase):
    def test_deep_links_return_the_built_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "index.html").write_text("<html>LEASH-SPA</html>", encoding="utf-8")
            with override_settings(FRONTEND_DIST=Path(tmp)):
                for path in ["/", "/dashboard", "/mandates/abc/audit", "/checkout/return"]:
                    response = self.client.get(path, secure=True)
                    self.assertEqual(response.status_code, 200, path)
                    self.assertIn(b"LEASH-SPA", response.content)
                    self.assertEqual(response["Cache-Control"], "no-cache")

    def test_unknown_api_paths_are_not_swallowed_by_the_app(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "index.html").write_text("<html>LEASH-SPA</html>", encoding="utf-8")
            with override_settings(FRONTEND_DIST=Path(tmp)):
                response = self.client.get("/api/does-not-exist/", secure=True)
                self.assertEqual(response.status_code, 404)
                self.assertNotIn(b"LEASH-SPA", response.content)

    def test_missing_build_gives_a_plain_404(self):
        with override_settings(FRONTEND_DIST=Path(tempfile.gettempdir()) / "leash-no-such-build"):
            response = self.client.get("/dashboard", secure=True)
            self.assertEqual(response.status_code, 404)

    def test_only_safe_methods_are_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "index.html").write_text("<html>LEASH-SPA</html>", encoding="utf-8")
            with override_settings(FRONTEND_DIST=Path(tmp)):
                response = self.client.post("/dashboard", secure=True)
                self.assertEqual(response.status_code, 405)
