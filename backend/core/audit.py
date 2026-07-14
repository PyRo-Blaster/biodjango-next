"""Explicit audit logging for API views.

Replaces the earlier ``ThreadLocalMiddleware`` + ``core/signals.py`` pair.
Signals implicitly hooked ``post_save`` on ``Project`` / ``ProteinSequence``
and pulled the actor out of a module-level ``threading.local()``. That
misfired in three ways:

- Celery tasks and management commands ran outside the middleware, so
  their saves recorded ``actor=None`` — the very audit rows you'd want
  most were the ones we lost.
- Bulk operations (``ProteinSequence.objects.bulk_create`` on FASTA
  upload) skip ``post_save`` entirely and produced zero audit rows.
- The signal received no diff, so ``UPDATE`` rows just said "someone
  updated project X".

This module inverts the design: views (which are the only place with a
real request context) call ``self.log_action(...)`` explicitly. The
``AuditMixin`` wires the three ``perform_*`` hooks so vanilla
``ModelViewSet`` subclasses get audit for free; custom actions like
``AccessRequestViewSet.review`` and the ``AnalysisTask`` submit views
call the helper directly.
"""

import logging

from django.contrib.contenttypes.models import ContentType

from .models import AuditLog

logger = logging.getLogger(__name__)


def _client_ip(request):
    if request is None:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_action(*, request, action, target, details=None):
    """Emit a single ``AuditLog`` row.

    ``request`` may be ``None`` for programmatic contexts; callers that
    have a DRF ``Request`` should always pass it so ``actor`` and
    ``ip_address`` are captured.
    """
    actor = None
    if request is not None:
        user = getattr(request, 'user', None)
        if user is not None and getattr(user, 'is_authenticated', False):
            actor = user

    try:
        AuditLog.objects.create(
            actor=actor,
            action=action,
            content_type=ContentType.objects.get_for_model(target.__class__),
            object_id=str(target.pk),
            ip_address=_client_ip(request),
            details=details or {},
        )
    except Exception:
        # Never let audit failure break the request path.
        logger.exception("Failed to write AuditLog row for %s / %s", target, action)


def _snapshot(instance, field_names):
    """Best-effort snapshot of ``field_names`` on ``instance`` as strings.

    ``AuditLog.details`` is JSON, so we stringify anything non-primitive
    (dates, foreign keys, etc.) to keep serialization boring.
    """
    snap = {}
    for name in field_names:
        try:
            value = getattr(instance, name)
        except AttributeError:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            snap[name] = value
        else:
            snap[name] = str(value)
    return snap


class AuditMixin:
    """Attach audit logging to a DRF ViewSet.

    Subclasses can inject extra ``.save()`` kwargs (e.g. ``owner=user``)
    by overriding ``get_create_kwargs()``. Every CRUD action produces
    exactly one ``AuditLog`` row.
    """

    audit_diff_fields = None  # None => diff whatever the request touched.

    def get_create_kwargs(self):
        return {}

    def log_action(self, action, target, details=None):
        log_action(
            request=getattr(self, 'request', None),
            action=action,
            target=target,
            details=details,
        )

    def perform_create(self, serializer):
        instance = serializer.save(**self.get_create_kwargs())
        self.log_action(
            AuditLog.Action.CREATE,
            instance,
            {'name': str(instance)},
        )

    def perform_update(self, serializer):
        fields = (
            self.audit_diff_fields
            if self.audit_diff_fields is not None
            else list(serializer.validated_data.keys())
        )
        before = _snapshot(serializer.instance, fields)
        instance = serializer.save()
        after = _snapshot(instance, fields)
        changes = {
            field: {'before': before.get(field), 'after': after.get(field)}
            for field in fields
            if before.get(field) != after.get(field)
        }
        self.log_action(
            AuditLog.Action.UPDATE,
            instance,
            {'name': str(instance), 'changes': changes},
        )

    def perform_destroy(self, instance):
        # Log before delete: Django clears ``instance.pk`` during ``delete()``
        # so the AuditLog row would end up pointing at object_id=None.
        self.log_action(AuditLog.Action.DELETE, instance, {'name': str(instance)})
        instance.delete()
