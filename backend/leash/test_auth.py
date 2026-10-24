from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .accounts import DEMO_PREFIX
from .throttles import LoginThrottle

PASSWORD = "a-long-test-password"
CREDENTIALS = {"username": "alice", "password": PASSWORD}


@override_settings(SECURE_SSL_REDIRECT=False, DEMO_MODE=False)
class AuthTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user("alice", password=PASSWORD)
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf_token(self):
        self.client.get("/api/auth/csrf/")
        return self.client.cookies["csrftoken"].value

    def post(self, url, data=None):
        return self.client.post(url, data, format="json", HTTP_X_CSRFTOKEN=self.csrf_token())


class LoginTests(AuthTestCase):
    def test_csrf_endpoint_sets_the_cookie(self):
        response = self.client.get("/api/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)

    def test_login_without_csrf_token_is_rejected(self):
        response = self.client.post("/api/auth/login/", CREDENTIALS, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["error"]["code"], "permission_denied")

    def test_login_me_logout_cycle(self):
        login = self.post("/api/auth/login/", CREDENTIALS)
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data["username"], "alice")
        self.assertFalse(login.data["is_demo"])
        self.assertEqual(self.client.get("/api/auth/me/").data["username"], "alice")
        self.assertEqual(self.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)

    def test_wrong_password_and_unknown_user_look_identical(self):
        wrong = self.post("/api/auth/login/", {"username": "alice", "password": "nope"})
        unknown = self.post("/api/auth/login/", {"username": "ghost", "password": "nope"})
        self.assertEqual(wrong.status_code, 403)
        self.assertEqual(wrong.data, unknown.data)

    def test_login_attempts_are_rate_limited(self):
        bad = {"username": "alice", "password": "nope"}
        with patch.object(LoginThrottle, "THROTTLE_RATES", {"login": "3/min"}):
            statuses = [self.post("/api/auth/login/", bad).status_code for _ in range(5)]
        self.assertEqual(statuses[:3], [403, 403, 403])
        self.assertEqual(statuses[3], 429)


class DemoTests(AuthTestCase):
    def test_demo_is_off_by_default(self):
        self.assertEqual(self.post("/api/auth/demo/").status_code, 404)

    @override_settings(DEMO_MODE=True)
    def test_each_demo_visit_gets_its_own_throwaway_account(self):
        first = self.post("/api/auth/demo/")
        self.assertEqual(first.status_code, 201)
        self.assertTrue(first.data["is_demo"])
        self.assertTrue(first.data["username"].startswith(DEMO_PREFIX))
        self.assertEqual(self.client.get("/api/auth/me/").data["id"], first.data["id"])

        second = self.post("/api/auth/demo/")
        self.assertNotEqual(first.data["id"], second.data["id"])
        account = get_user_model().objects.get(pk=first.data["id"])
        self.assertFalse(account.has_usable_password())


class PurgeCommandTests(AuthTestCase):
    def test_removes_only_stale_demo_accounts(self):
        users = get_user_model().objects
        stale = users.create_user(f"{DEMO_PREFIX}stale")
        users.create_user(f"{DEMO_PREFIX}fresh")
        users.filter(pk=stale.pk).update(date_joined=timezone.now() - timedelta(hours=48))
        call_command("purge_demo_users", "--hours", "24", stdout=StringIO())
        remaining = set(users.values_list("username", flat=True))
        self.assertEqual(remaining, {"alice", f"{DEMO_PREFIX}fresh"})
