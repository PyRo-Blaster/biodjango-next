from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient


class AuthEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

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
