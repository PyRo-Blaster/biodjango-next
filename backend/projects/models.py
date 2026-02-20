from django.db import models
from django.contrib.auth.models import User
import uuid

class Project(models.Model):
    """
    Represents a scientific project that contains multiple sequences.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_projects')
    allowed_users = models.ManyToManyField(User, related_name='allowed_projects', blank=True)
    is_public = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class ProteinSequence(models.Model):
    """
    A protein sequence belonging to a project.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='sequences')
    name = models.CharField(max_length=255)
    sequence = models.TextField(help_text="FASTA format or raw sequence")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.project.name})"

class AccessRequest(models.Model):
    """
    A request from a user to access a specific project.
    """
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_requests')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='access_requests')
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_requests')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'project') # One pending request per user/project ideally, but simple unique is safer

    def __str__(self):
        return f"{self.user.username} -> {self.project.name} ({self.status})"
