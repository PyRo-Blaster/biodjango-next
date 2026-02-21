from django.db import models
import uuid
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User

class Project(models.Model):
    project_id = models.CharField(max_length=50, unique=True, help_text="Unique identifier for the project")
    security_key = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self) -> str:
        return self.project_id
    
    class Meta:
        ordering = ['-created_at']

class AA_Sequence(models.Model):
    project = models.ForeignKey(Project, related_name='aa_sequences', on_delete=models.CASCADE)
    sequence = models.TextField()
    name = models.CharField(max_length=100, blank=True, null=True, help_text="Optional name for the sequence")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "AA Sequence"
        verbose_name_plural = "AA Sequences"

    def __str__(self) -> str:
        return f"AA Sequence {self.id} for {self.project.project_id}"

class DNA_Sequence(models.Model):
    project = models.ForeignKey(Project, related_name='dna_sequences', on_delete=models.CASCADE)
    sequence = models.TextField()
    name = models.CharField(max_length=100, blank=True, null=True, help_text="Optional name for the sequence")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "DNA Sequence"
        verbose_name_plural = "DNA Sequences"

    def __str__(self) -> str:
        return f"DNA Sequence {self.id} for {self.project.project_id}"

class AuditLog(models.Model):
    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('EXPORT', 'Export'),
    )

    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    
    # Target object (Generic Relation)
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)
    object_id = models.CharField(max_length=50, null=True) # UUIDs are strings or ints
    target = GenericForeignKey('content_type', 'object_id')
    
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.actor} {self.action} {self.content_type} ({self.timestamp})"
