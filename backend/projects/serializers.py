from rest_framework import serializers

from core.serializers import UserSerializer

from .models import Project, ProteinSequence, AccessRequest


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

    def _prefetched_access_requests(self, obj):
        return getattr(obj, "_prefetched_objects_cache", {}).get("access_requests")

    def _prefetched_allowed_users(self, obj):
        return getattr(obj, "_prefetched_objects_cache", {}).get("allowed_users")

    def get_access_status(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return None
        access_requests = self._prefetched_access_requests(obj)
        if access_requests is not None:
            for req in access_requests:
                if req.user_id == user.id:
                    return req.status
            return None
        req = AccessRequest.objects.filter(user=user, project=obj).only("status").first()
        return req.status if req else None

    def get_is_allowed(self, obj):
        user = self.context['request'].user
        if not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        if obj.owner_id == user.id or obj.is_public:
            return True
        allowed_users = self._prefetched_allowed_users(obj)
        if allowed_users is not None:
            return any(allowed_user.id == user.id for allowed_user in allowed_users)
        return obj.allowed_users.filter(id=user.id).exists()

class AccessRequestSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = AccessRequest
        fields = ['id', 'user', 'project', 'project_name', 'reason', 'status', 'created_at']
        read_only_fields = ['status', 'user', 'created_at']
