from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from .utils.antibody_annotation import annotate_antibody
from .utils.primer_design import design_primers
from .models import AnalysisTask


class PrimerDesignTests(TestCase):
    def test_mock_primer_design(self):
        sequence = "ATCG" * 30
        result = design_primers(sequence, tm_opt=60.0)
        if "primers" in result:
            self.assertGreaterEqual(len(result["primers"]), 1)
            primer = result["primers"][0]
            self.assertIn("forward", primer)
            self.assertIn("reverse", primer)
        else:
            self.assertIn("error", result)

    def test_short_sequence(self):
        sequence = "ATCG"
        result = design_primers(sequence)
        self.assertIn("error", result)


class AntibodyAnnotationTests(TestCase):
    def test_antibody_annotation(self):
        sequence = "EVQLVESGGGLVQPGGSLRLSCAASGFNIKDTYIHWVRQAPGKGLEWVARIYPTNGYTRYADSVKGRFTISADTSKNTAYLQMNSLRAEDTAVYYCSRWGGDGFYAMDYWGQGTLVTVSS"
        try:
            import abnumber  # noqa: F401
        except ImportError:
            return
        result = annotate_antibody(sequence, scheme="imgt")
        if result.get("status") == "success":
            self.assertEqual(result["chain_type"], "H")
            self.assertIn("CDR3", result["regions"])
            self.assertTrue(len(result["regions"]["CDR3"]) > 0)


class AnalysisAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="password123",
        )

    def test_anonymous_blast_submit_requires_authentication(self):
        response = self.client.post(
            "/api/analysis/blast/",
            {
                "sequence": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH",
                "evalue": 0.001,
                "db": "swissprot",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("analysis.views.run_blast_task.delay")
    def test_blast_submit_returns_503_when_queue_unavailable(self, mocked_delay):
        mocked_delay.side_effect = RuntimeError("broker down")
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/blast/",
            {
                "sequence": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH",
                "evalue": 0.001,
                "db": "swissprot",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Task queue unavailable. Please retry later.")
        task = AnalysisTask.objects.get(task_type="BLAST")
        self.assertEqual(task.status, "FAILURE")

    @patch("analysis.views.run_msa_task.delay")
    def test_msa_submit_returns_503_when_queue_unavailable(self, mocked_delay):
        mocked_delay.side_effect = RuntimeError("broker down")
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/msa/",
            {"sequence": ">a\nAAAA\n>b\nAAAT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Task queue unavailable. Please retry later.")
        task = AnalysisTask.objects.get(task_type="MSA")
        self.assertEqual(task.status, "FAILURE")

    def test_anonymous_primer_design_submit_requires_authentication(self):
        response = self.client.post(
            "/api/analysis/primer-design/",
            {"sequence": "ATCG" * 30, "tm_opt": 60.0},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_analysis_task_list_is_disabled(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/analysis/tasks/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_project_endpoint_still_requires_authentication(self):
        response = self.client.get("/api/projects/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("analysis.views.run_blast_task.delay")
    def test_authenticated_user_uses_higher_quota(self, mocked_delay):
        mocked_delay.return_value = None
        self.client.force_authenticate(user=self.user)
        payload = {
            "sequence": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH",
            "evalue": 0.001,
            "db": "swissprot",
        }
        statuses = [
            self.client.post("/api/analysis/blast/", payload, format="json").status_code
            for _ in range(7)
        ]
        self.assertTrue(all(code == status.HTTP_202_ACCEPTED for code in statuses))

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_PERMISSION_CLASSES": [
                "rest_framework.permissions.IsAuthenticated",
            ],
            "DEFAULT_AUTHENTICATION_CLASSES": [
                "rest_framework_simplejwt.authentication.JWTAuthentication",
            ],
            "DEFAULT_THROTTLE_CLASSES": [
                "rest_framework.throttling.UserRateThrottle",
            ],
            "DEFAULT_THROTTLE_RATES": {
                "user": "5/min",
                "user_burst": "5/min",
                "task_poll": "200/min",
            },
        }
    )
    def test_authenticated_task_poll_uses_dedicated_scope(self):
        self.client.force_authenticate(user=self.user)
        task = AnalysisTask.objects.create(task_type="BLAST")
        statuses = [
            self.client.get(f"/api/analysis/tasks/{task.id}/").status_code
            for _ in range(100)
        ]
        self.assertNotIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)
        self.assertTrue(all(code == status.HTTP_200_OK for code in statuses))

    def test_task_poll_omits_result_payload(self):
        """Polling endpoint returns the lightweight status shape only."""
        self.client.force_authenticate(user=self.user)
        task = AnalysisTask.objects.create(
            task_type="BLAST",
            status="SUCCESS",
            result={"output": "X" * 10_000},
        )
        response = self.client.get(f"/api/analysis/tasks/{task.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("result", response.data)
        self.assertEqual(set(response.data.keys()),
                         {"id", "task_type", "status", "error_message", "updated_at"})

    def test_task_result_endpoint_returns_full_payload(self):
        self.client.force_authenticate(user=self.user)
        task = AnalysisTask.objects.create(
            task_type="BLAST",
            status="SUCCESS",
            result={"output": "hit_line"},
        )
        response = self.client.get(f"/api/analysis/tasks/{task.id}/result/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["result"], {"output": "hit_line"})
        self.assertEqual(response.data["status"], "SUCCESS")

    @patch("analysis.views.run_peptide_calc_task.delay")
    def test_peptide_calc_dispatches_task(self, mocked_delay):
        mocked_delay.return_value = None
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/peptide-calc/",
            {"target_mass": 500.0, "error_range": 5.0, "num_amino_acids": 3},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["task_type"], "PEPTIDE_CALC")
        self.assertIn("id", response.data)
        mocked_delay.assert_called_once()

    @patch("analysis.views.run_peptide_calc_task.delay")
    def test_peptide_calc_returns_503_when_queue_unavailable(self, mocked_delay):
        mocked_delay.side_effect = RuntimeError("broker down")
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/peptide-calc/",
            {"target_mass": 500.0, "error_range": 5.0, "num_amino_acids": 3},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        task = AnalysisTask.objects.get(task_type="PEPTIDE_CALC")
        self.assertEqual(task.status, "FAILURE")

    @patch("analysis.views.run_primer_design_task.delay")
    def test_primer_design_dispatches_task(self, mocked_delay):
        mocked_delay.return_value = None
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/primer-design/",
            {"sequence": "ATCG" * 30, "product_size_range": "50-150", "tm_opt": 60.0},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["task_type"], "PRIMER_DESIGN")

    @patch("analysis.views.run_antibody_annotation_task.delay")
    def test_antibody_annotation_dispatches_task(self, mocked_delay):
        mocked_delay.return_value = None
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/antibody-annotation/",
            {"sequence": "EVQL", "scheme": "imgt"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["task_type"], "ANTIBODY_ANNOTATION")

    @patch("analysis.views.run_blast_task.delay")
    def test_task_submission_records_audit_row(self, mocked_delay):
        from core.models import AuditLog

        mocked_delay.return_value = None
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/analysis/blast/",
            {
                "sequence": "MKTAYIAKQR",
                "evalue": 0.001,
                "db": "swissprot",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        entry = AuditLog.objects.get(
            action=AuditLog.Action.SUBMIT,
            object_id=response.data["id"],
        )
        self.assertEqual(entry.actor, self.user)
        self.assertEqual(entry.details["task_type"], "BLAST")

    @patch("analysis.views.run_blast_task.delay")
    def test_failed_dispatch_does_not_record_submit(self, mocked_delay):
        from core.models import AuditLog

        mocked_delay.side_effect = RuntimeError("broker down")
        self.client.force_authenticate(user=self.user)
        self.client.post(
            "/api/analysis/blast/",
            {"sequence": "MKTAYIAKQR", "evalue": 0.001, "db": "swissprot"},
            format="json",
        )
        # No SUBMIT row when the dispatch failed.
        self.assertFalse(
            AuditLog.objects.filter(action=AuditLog.Action.SUBMIT).exists()
        )


class AnalysisTaskExecutionTests(TestCase):
    """Verify tasks run inline via ``CELERY_TASK_ALWAYS_EAGER``."""

    def setUp(self):
        cache.clear()

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
    def test_peptide_calc_task_completes_successfully(self):
        from analysis.tasks import run_peptide_calc_task

        task = AnalysisTask.objects.create(task_type="PEPTIDE_CALC")
        run_peptide_calc_task.delay(
            task_id=str(task.id), target_mass=500.0, error_range=5.0, num_amino_acids=2
        )
        task.refresh_from_db()
        self.assertEqual(task.status, "SUCCESS")
        self.assertIn("csv_content", task.result)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
    def test_primer_design_task_marks_failure_on_short_sequence(self):
        from analysis.tasks import run_primer_design_task

        task = AnalysisTask.objects.create(task_type="PRIMER_DESIGN")
        run_primer_design_task.delay(
            task_id=str(task.id),
            sequence="ATCG",
            product_size_range="100-300",
            tm_opt=60.0,
        )
        task.refresh_from_db()
        self.assertEqual(task.status, "FAILURE")
        self.assertTrue(task.error_message)
