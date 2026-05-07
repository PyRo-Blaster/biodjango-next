from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import AccessRequest, Project, ProteinSequence
from .utils import validate_fasta

class FastaValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.project = Project.objects.create(name='Test Project', owner=self.user)

    def test_valid_fasta(self):
        content = ">seq1\nACDEFGH\n>seq2\nIKLMNPQ"
        valid, errors = validate_fasta(content, self.project)
        self.assertEqual(len(valid), 2)
        self.assertEqual(len(errors), 0)
        self.assertEqual(valid[0]['name'], 'seq1')
        self.assertEqual(valid[0]['sequence'], 'ACDEFGH')

    def test_invalid_characters(self):
        content = ">seq1\nACDZ" # Z is invalid
        valid, errors = validate_fasta(content, self.project)
        self.assertEqual(len(valid), 0)
        self.assertEqual(len(errors), 1)
        self.assertIn("Contains invalid characters", errors[0])

    def test_duplicate_in_file(self):
        content = ">seq1\nACDE\n>seq1\nFGHI"
        valid, errors = validate_fasta(content, self.project)
        self.assertEqual(len(valid), 1) # First one is accepted
        self.assertEqual(len(errors), 1) # Second one is duplicate
        self.assertIn("Duplicate ID in uploaded file", errors[0])

    def test_duplicate_in_project(self):
        ProteinSequence.objects.create(project=self.project, name='seq1', sequence='ACDE')
        content = ">seq1\nFGHI"
        valid, errors = validate_fasta(content, self.project)
        self.assertEqual(len(valid), 0)
        self.assertEqual(len(errors), 1)
        self.assertIn("Sequence ID already exists in this project", errors[0])

    def test_empty_sequence(self):
        content = ">seq1\n"
        valid, errors = validate_fasta(content, self.project)
        self.assertEqual(len(valid), 0)
        self.assertEqual(len(errors), 1)
        self.assertIn("Empty sequence", errors[0])


class ProjectPermissionAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="owner", password="password123")
        self.other_user = User.objects.create_user(username="other", password="password123")
        self.requester = User.objects.create_user(username="requester", password="password123")
        self.staff = User.objects.create_user(
            username="staff",
            password="password123",
            is_staff=True,
        )
        self.project = Project.objects.create(
            name="Genome Mapping",
            description="Internal project",
            owner=self.owner,
        )
        self.access_request = AccessRequest.objects.create(
            user=self.requester,
            project=self.project,
            reason="Need access for analysis",
        )
        self.sequence = ProteinSequence.objects.create(
            project=self.project,
            name="seq1",
            sequence="ACDEFGHIK",
        )

    def test_authenticated_user_can_create_project(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(
            "/api/projects/",
            {"name": "Proteomics Lab", "description": "Owned by a regular user"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Project.objects.get(name="Proteomics Lab")
        self.assertEqual(created.owner, self.other_user)

    def test_non_owner_cannot_update_project(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.patch(
            f"/api/projects/{self.project.id}/",
            {"description": "Changed by unauthorized user"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_update_any_project(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(
            f"/api/projects/{self.project.id}/",
            {"description": "Changed by staff"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.project.refresh_from_db()
        self.assertEqual(self.project.description, "Changed by staff")

    def test_owner_can_review_access_request(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/projects/access-requests/{self.access_request.id}/review/",
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.access_request.refresh_from_db()
        self.assertEqual(self.access_request.status, "APPROVED")
        self.assertTrue(
            self.project.allowed_users.filter(id=self.requester.id).exists()
        )

    def test_non_owner_non_staff_cannot_review_access_request(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.patch(
            f"/api/projects/access-requests/{self.access_request.id}/review/",
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inaccessible_sequences_return_403(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.get(
            f"/api/projects/sequences/?project_id={self.project.id}",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
