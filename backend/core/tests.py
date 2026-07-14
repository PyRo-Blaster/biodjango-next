from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from config import settings as project_settings


class AuthEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()

    def test_register_returns_201(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "new_user",
                "email": "new_user@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="new_user").exists())

    def test_token_obtain_returns_200(self):
        User.objects.create_user(
            username="token_user",
            email="token_user@example.com",
            password="StrongPass123!",
        )
        response = self.client.post(
            "/api/auth/token/",
            {"username": "token_user", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)


class RegisterThrottleTests(TestCase):
    """Registration is capped at ``anon_register`` (5/day per IP)."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()

    def _payload(self, i):
        return {
            "username": f"user_{i}",
            "email": f"user_{i}@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }

    def test_register_throttles_after_five_attempts(self):
        for i in range(5):
            response = self.client.post(
                "/api/auth/register/", self._payload(i), format="json"
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_201_CREATED,
                msg=f"attempt {i} unexpectedly {response.status_code}",
            )
        response = self.client.post(
            "/api/auth/register/", self._payload(5), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class EnvParsingHelperTests(TestCase):
    def test_env_bool_truthy_values(self):
        for token in ("1", "true", "TRUE", "yes", "on", "Y"):
            self.assertTrue(
                project_settings.env_bool(
                    "BIODJANGO_TEST_UNSET", default=False
                )
                or _run_env_bool(token)
            )

    def test_env_bool_falsy_values(self):
        for token in ("0", "false", "no", "off", "", "garbage"):
            self.assertFalse(_run_env_bool(token))

    def test_env_bool_missing_returns_default(self):
        self.assertTrue(
            project_settings.env_bool(
                "BIODJANGO_TEST_UNSET_MISSING_VAR", default=True
            )
        )
        self.assertFalse(
            project_settings.env_bool(
                "BIODJANGO_TEST_UNSET_MISSING_VAR", default=False
            )
        )

    def test_env_list_splits_on_comma_and_whitespace(self):
        import os

        os.environ["BIODJANGO_TEST_LIST"] = "a, b\nc,,d  e"
        try:
            self.assertEqual(
                project_settings.env_list("BIODJANGO_TEST_LIST"),
                ["a", "b", "c", "d", "e"],
            )
        finally:
            del os.environ["BIODJANGO_TEST_LIST"]

    def test_env_list_missing_returns_default(self):
        self.assertEqual(
            project_settings.env_list(
                "BIODJANGO_TEST_LIST_UNSET_VAR", default=["fallback"]
            ),
            ["fallback"],
        )


def _run_env_bool(value):
    import os

    os.environ["BIODJANGO_TEST_BOOL_VAR"] = value
    try:
        return project_settings.env_bool("BIODJANGO_TEST_BOOL_VAR")
    finally:
        del os.environ["BIODJANGO_TEST_BOOL_VAR"]
