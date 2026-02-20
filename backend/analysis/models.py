from django.db import models
import uuid

class AnalysisTask(models.Model):
    TASK_TYPES = [
        ('BLAST', 'BLAST'),
        ('IGBLAST', 'IgBLAST'),
        ('MSA', 'Multiple Sequence Alignment'),
        ('PEPTIDE_CALC', 'Peptide Calculator'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('STARTED', 'Started'),
        ('SUCCESS', 'Success'),
        ('FAILURE', 'Failure'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_type = models.CharField(max_length=20, choices=TASK_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    result = models.JSONField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    
    # Optional: Link to a project or user if needed
    # project = models.ForeignKey('core.Project', on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.task_type} - {self.id} ({self.status})"
