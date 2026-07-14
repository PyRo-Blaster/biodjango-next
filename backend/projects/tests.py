import io

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import AuditLog

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


class AuditMixinTests(TestCase):
    """Every mutating action produces a single AuditLog row with the right actor."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username="alice", password="pw123")
        self.other = User.objects.create_user(username="bob", password="pw123")
        self.project = Project.objects.create(
            name="Genome Mapping",
            description="Original description",
            owner=self.owner,
        )

    def test_create_project_writes_audit_row(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.post(
            "/api/projects/",
            {"name": "New Project", "description": "New"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        entry = AuditLog.objects.get(action=AuditLog.Action.CREATE, object_id=response.data["id"])
        self.assertEqual(entry.actor, self.other)
        self.assertEqual(entry.details["name"], "New Project")

    def test_update_project_records_before_after_diff(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/projects/{self.project.id}/",
            {"description": "Updated description"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = AuditLog.objects.get(
            action=AuditLog.Action.UPDATE,
            object_id=str(self.project.id),
        )
        self.assertEqual(entry.actor, self.owner)
        self.assertEqual(
            entry.details["changes"]["description"],
            {"before": "Original description", "after": "Updated description"},
        )

    def test_delete_project_records_audit_with_pre_delete_identity(self):
        self.client.force_authenticate(user=self.owner)
        project_id = str(self.project.id)
        response = self.client.delete(f"/api/projects/{self.project.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        entry = AuditLog.objects.get(action=AuditLog.Action.DELETE, object_id=project_id)
        self.assertEqual(entry.actor, self.owner)

    def test_review_records_approve_action(self):
        requester = User.objects.create_user(username="requester", password="pw123")
        req = AccessRequest.objects.create(
            user=requester, project=self.project, reason="please"
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/projects/access-requests/{req.id}/review/",
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = AuditLog.objects.get(action=AuditLog.Action.APPROVE, object_id=str(req.id))
        self.assertEqual(entry.actor, self.owner)
        self.assertEqual(entry.details["requester"], "requester")

    def test_review_reject_records_reject_action(self):
        requester = User.objects.create_user(username="requester2", password="pw123")
        req = AccessRequest.objects.create(
            user=requester, project=self.project, reason="please"
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/projects/access-requests/{req.id}/review/",
            {"status": "REJECTED"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.Action.REJECT, object_id=str(req.id)
            ).exists()
        )

    def test_upload_fasta_records_batch_audit(self):
        self.client.force_authenticate(user=self.owner)
        fasta = io.BytesIO(b">seqA\nACDE\n>seqB\nFGHI\n")
        fasta.name = "test.fasta"
        response = self.client.post(
            f"/api/projects/{self.project.id}/upload_fasta/",
            {"file": fasta},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = AuditLog.objects.get(
            action=AuditLog.Action.CREATE,
            object_id=str(self.project.id),
        )
        self.assertEqual(entry.actor, self.owner)
        self.assertEqual(entry.details["event"], "bulk_fasta_upload")
        self.assertEqual(entry.details["count"], 2)
        self.assertIn("seqA", entry.details["sequence_names"])
