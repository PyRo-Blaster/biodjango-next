from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Project, ProteinSequence, AccessRequest
from .serializers import ProjectSerializer, ProteinSequenceSerializer, AccessRequestSerializer
from .permissions import IsAdminOrReadOnly, HasProjectAccess
from Bio import SeqIO
import io

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated] # Default base, refined by custom perms

    def get_queryset(self):
        user = self.request.user
        # Admins see all
        if user.is_staff:
            return Project.objects.all()
        # Users see public projects + projects they are allowed in
        # But we want users to SEE all projects in the list (metadata), just not access details.
        # So we return all projects for LIST, but restrict RETRIEVE.
        return Project.objects.all()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'upload_fasta']:
            return [permissions.IsAdminUser()]
        if self.action == 'retrieve':
            return [HasProjectAccess()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['post'], parser_classes=[parsers.MultiPartParser])
    def upload_fasta(self, request, pk=None):
        """
        Bulk upload sequences via FASTA file.
        """
        project = self.get_object()
        file_obj = request.data.get('file')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Decode file content
            content = file_obj.read().decode('utf-8')
            fasta_io = io.StringIO(content)
            
            sequences_to_create = []
            for record in SeqIO.parse(fasta_io, "fasta"):
                sequences_to_create.append(ProteinSequence(
                    project=project,
                    name=record.id,
                    sequence=str(record.seq),
                    metadata={"description": record.description}
                ))
            
            if not sequences_to_create:
                return Response({"error": "No valid sequences found in FASTA"}, status=status.HTTP_400_BAD_REQUEST)

            ProteinSequence.objects.bulk_create(sequences_to_create)
            
            return Response({
                "status": "success", 
                "count": len(sequences_to_create),
                "message": f"Successfully uploaded {len(sequences_to_create)} sequences."
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ProteinSequenceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view for sequences. Creation happens via Project bulk upload or admin.
    """
    serializer_class = ProteinSequenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.request.query_params.get('project_id')
        if not project_id:
            return ProteinSequence.objects.none()
        
        # Check permission for the project
        try:
            project = Project.objects.get(id=project_id)
            if not HasProjectAccess().has_object_permission(self.request, self, project):
                return ProteinSequence.objects.none()
            return project.sequences.all()
        except Project.DoesNotExist:
            return ProteinSequence.objects.none()

class AccessRequestViewSet(viewsets.ModelViewSet):
    serializer_class = AccessRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return AccessRequest.objects.all().order_by('-created_at')
        return AccessRequest.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[permissions.IsAdminUser])
    def review(self, request, pk=None):
        """
        Approve or Reject a request.
        """
        access_request = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
            
        access_request.status = new_status
        access_request.reviewed_by = request.user
        access_request.save()

        if new_status == 'APPROVED':
            access_request.project.allowed_users.add(access_request.user)
            
        return Response({"status": "success", "new_status": new_status})
