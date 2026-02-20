from django.db import models
import uuid

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
