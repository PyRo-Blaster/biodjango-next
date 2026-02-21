from django.test import TestCase
from django.contrib.auth.models import User
from .models import Project, ProteinSequence
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
