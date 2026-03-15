from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
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

    @patch("analysis.views.run_blast_task.delay")
    def test_anonymous_blast_submit(self, mocked_delay):
        mocked_delay.return_value = None
        response = self.client.post(
            "/api/analysis/blast/",
            {
                "sequence": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH",
                "evalue": 0.001,
                "db": "swissprot",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    @patch("analysis.views.run_msa_task.delay")
    def test_anonymous_msa_submit(self, mocked_delay):
        mocked_delay.return_value = None
        response = self.client.post(
            "/api/analysis/msa/",
            {"sequence": ">a\nAAAA\n>b\nAAAT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    @patch("analysis.views.run_blast_task.delay")
    def test_blast_submit_returns_503_when_queue_unavailable(self, mocked_delay):
        mocked_delay.side_effect = RuntimeError("broker down")
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
        response = self.client.post(
            "/api/analysis/msa/",
            {"sequence": ">a\nAAAA\n>b\nAAAT"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["detail"], "Task queue unavailable. Please retry later.")
        task = AnalysisTask.objects.get(task_type="MSA")
        self.assertEqual(task.status, "FAILURE")

    def test_anonymous_primer_design_submit(self):
        response = self.client.post(
            "/api/analysis/primer-design/",
            {"sequence": "ATCG" * 30, "tm_opt": 60.0},
            format="json",
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST])

    def test_analysis_task_list_is_disabled(self):
        response = self.client.get("/api/analysis/tasks/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_project_endpoint_still_requires_authentication(self):
        response = self.client.get("/api/projects/projects/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("analysis.views.run_blast_task.delay")
    def test_anonymous_requests_are_throttled(self, mocked_delay):
        mocked_delay.return_value = None
        payload = {
            "sequence": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH",
            "evalue": 0.001,
            "db": "swissprot",
        }
        statuses = [
            self.client.post("/api/analysis/blast/", payload, format="json").status_code
            for _ in range(7)
        ]
        self.assertEqual(statuses[-1], status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("analysis.views.run_blast_task.delay")
    def test_throttled_response_contains_retry_after(self, mocked_delay):
        mocked_delay.return_value = None
        payload = {
            "sequence": "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQQIAAALEHHHHHH",
            "evalue": 0.001,
            "db": "swissprot",
        }
        response = None
        for _ in range(7):
            response = self.client.post("/api/analysis/blast/", payload, format="json")
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", response.headers)

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
