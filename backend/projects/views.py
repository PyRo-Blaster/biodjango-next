from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from django.utils import timezone

from core.audit import AuditMixin, log_action
from core.models import AuditLog

from .models import Project, ProteinSequence, AccessRequest
from .serializers import ProjectSerializer, ProteinSequenceSerializer, AccessRequestSerializer
from .permissions import (
    CanReviewAccessRequest,
    HasProjectAccess,
    IsOwnerOrStaffOrReadOnly,
)
from .utils import validate_fasta


class ProjectViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Project.objects.select_related("owner")
            .prefetch_related("allowed_users", "access_requests")
            .annotate(sequences_count=Count("sequences"))
        )

    def get_create_kwargs(self):
        return {"owner": self.request.user}

    def get_permissions(self):
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy", "upload_fasta"):
            return [permissions.IsAuthenticated(), IsOwnerOrStaffOrReadOnly()]
        if self.action == "retrieve":
            return [permissions.IsAuthenticated(), HasProjectAccess()]
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get project statistics."""
        user = request.user
        total_projects = Project.objects.count()
        total_sequences = ProteinSequence.objects.count()

        visible = self.get_queryset()
        if not user.is_staff:
            visible = visible.filter(
                Q(owner=user) | Q(is_public=True) | Q(allowed_users=user)
            ).distinct()
        recent_projects = visible.order_by('-created_at')[:5]

        return Response({
            "total_projects": total_projects,
            "total_sequences": total_sequences,
            "recent_projects": ProjectSerializer(
                recent_projects, many=True, context={'request': request}
            ).data,
        })

    @action(detail=True, methods=['post'], parser_classes=[parsers.MultiPartParser])
    def upload_fasta(self, request, pk=None):
        """Bulk upload sequences via FASTA file with validation."""
        project = self.get_object()
        file_obj = request.data.get('file')

        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            content = file_obj.read().decode('utf-8')
            valid_data, errors = validate_fasta(content, project)

            if errors:
                return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

            if not valid_data:
                return Response({"error": "No valid sequences found"}, status=status.HTTP_400_BAD_REQUEST)

            sequences_to_create = [
                ProteinSequence(
                    project=project,
                    name=item['name'],
                    sequence=item['sequence'],
                    metadata=item['metadata'],
                ) for item in valid_data
            ]

            ProteinSequence.objects.bulk_create(sequences_to_create)

            # ``bulk_create`` doesn't fire per-row signals; log a single
            # aggregate row against the project so the upload is visible.
            log_action(
                request=request,
                action=AuditLog.Action.CREATE,
                target=project,
                details={
                    'event': 'bulk_fasta_upload',
                    'project': project.name,
                    'count': len(sequences_to_create),
                    'sequence_names': [item['name'] for item in valid_data[:20]],
                },
            )

            return Response({
                "status": "success",
                "count": len(sequences_to_create),
                "message": f"Successfully uploaded {len(sequences_to_create)} sequences.",
            })

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProteinSequenceViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for sequences. Creation happens via Project bulk upload or admin."""

    serializer_class = ProteinSequenceSerializer
    permission_classes = [permissions.IsAuthenticated, HasProjectAccess]

    def get_queryset(self):
        project_id = self.request.query_params.get("project_id")
        if not project_id:
            return ProteinSequence.objects.none()

        project = get_object_or_404(Project, id=project_id)
        self.check_object_permissions(self.request, project)
        return project.sequences.select_related("project").all()


class AccessRequestViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = AccessRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = AccessRequest.objects.select_related(
            "user", "project", "project__owner"
        )
        if user.is_staff:
            return base.order_by('-created_at')
        if self.action == "review":
            return base.order_by("-created_at")
        return base.filter(
            Q(user=user) | Q(project__owner=user)
        ).distinct().order_by("-created_at")

    def get_create_kwargs(self):
        return {"user": self.request.user}

    @action(
        detail=True,
        methods=["patch"],
        permission_classes=[permissions.IsAuthenticated, CanReviewAccessRequest],
    )
    def review(self, request, pk=None):
        """Approve or reject an access request."""
        access_request = self.get_object()
        new_status = request.data.get('status')

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

        previous_status = access_request.status
        access_request.status = new_status
        access_request.reviewed_by = request.user
        access_request.reviewed_at = timezone.now()
        access_request.save(update_fields=["status", "reviewed_by", "reviewed_at"])

        if new_status == 'APPROVED':
            access_request.project.allowed_users.add(access_request.user)

        log_action(
            request=request,
            action=AuditLog.Action.APPROVE if new_status == 'APPROVED' else AuditLog.Action.REJECT,
            target=access_request,
            details={
                'project': access_request.project.name,
                'requester': access_request.user.username,
                'previous_status': previous_status,
                'new_status': new_status,
            },
        )

        return Response({"status": "success", "new_status": new_status})
