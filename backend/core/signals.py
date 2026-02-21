from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from projects.models import Project, ProteinSequence
from core.models import AuditLog
from core.middleware import get_current_user, get_current_ip
from django.contrib.contenttypes.models import ContentType

@receiver(post_save, sender=Project)
@receiver(post_save, sender=ProteinSequence)
def log_save(sender, instance, created, **kwargs):
    user = get_current_user()
    ip = get_current_ip()
    
    action = 'CREATE' if created else 'UPDATE'
    
    # Avoid logging if it's an internal system action without user context? 
    # Or just log with None actor.
    
    AuditLog.objects.create(
        actor=user if user and user.is_authenticated else None,
        action=action,
        content_type=ContentType.objects.get_for_model(sender),
        object_id=str(instance.id),
        ip_address=ip,
        details={
            'name': str(instance),
            'description': f"{action} {sender.__name__}"
        }
    )

@receiver(post_delete, sender=Project)
@receiver(post_delete, sender=ProteinSequence)
def log_delete(sender, instance, **kwargs):
    user = get_current_user()
    ip = get_current_ip()
    
    AuditLog.objects.create(
        actor=user if user and user.is_authenticated else None,
        action='DELETE',
        content_type=ContentType.objects.get_for_model(sender),
        object_id=str(instance.id),
        ip_address=ip,
        details={
            'name': str(instance),
            'description': f"DELETE {sender.__name__}"
        }
    )
