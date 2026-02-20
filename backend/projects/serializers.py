from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Project, ProteinSequence, AccessRequest

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class ProteinSequenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProteinSequence
        fields = ['id', 'name', 'sequence', 'metadata', 'created_at']

class ProjectSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    sequences_count = serializers.IntegerField(source='sequences.count', read_only=True)
    access_status = serializers.SerializerMethodField()
    is_allowed = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'created_at', 'owner', 'sequences_count', 'is_public', 'access_status', 'is_allowed']
        read_only_fields = ['created_at', 'owner']

    def get_access_status(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        # Check if there is a pending request
        try:
            req = AccessRequest.objects.get(user=user, project=obj)
            return req.status
        except AccessRequest.DoesNotExist:
            return None

    def get_is_allowed(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        return obj.allowed_users.filter(id=user.id).exists()

class AccessRequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = AccessRequest
        fields = ['id', 'user', 'project', 'project_name', 'reason', 'status', 'created_at']
        read_only_fields = ['status', 'user', 'created_at']
