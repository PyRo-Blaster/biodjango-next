from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .models import Project, AA_Sequence, DNA_Sequence, AuditLog
from .serializers import ProjectSerializer, AA_SequenceSerializer, DNA_SequenceSerializer, RegisterSerializer, UserSerializer, CustomTokenObtainPairSerializer, AuditLogSerializer
import uuid

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "user": UserSerializer(user, context=self.get_serializer_context()).data,
                "message": "User Created Successfully.  Now perform Login to get your token",
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.AllowAny] # In production, restrict this

    @action(detail=False, methods=['post'])
    def verify(self, request):
        """
        Verify project credentials.
        """
        project_id = request.data.get('project_id')
        security_key = request.data.get('security_key')

        try:
            project = Project.objects.get(project_id=project_id, security_key=security_key)
            return Response({'status': 'verified', 'id': project.id}, status=status.HTTP_200_OK)
        except Project.DoesNotExist:
            return Response({'status': 'invalid'}, status=status.HTTP_401_UNAUTHORIZED)

class AA_SequenceViewSet(viewsets.ModelViewSet):
    queryset = AA_Sequence.objects.all()
    serializer_class = AA_SequenceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        """
        Optionally restricts the returned sequences to a given project,
        by filtering against a `project_id` query parameter in the URL.
        """
        queryset = AA_Sequence.objects.all()
        project_id = self.request.query_params.get('project_id')
        if project_id is not None:
            queryset = queryset.filter(project__project_id=project_id)
        return queryset

class DNA_SequenceViewSet(viewsets.ModelViewSet):
    queryset = DNA_Sequence.objects.all()
    serializer_class = DNA_SequenceSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = DNA_Sequence.objects.all()
        project_id = self.request.query_params.get('project_id')
        if project_id is not None:
            queryset = queryset.filter(project__project_id=project_id)
        return queryset

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAdminUser]
