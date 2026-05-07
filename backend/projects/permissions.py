from rest_framework import permissions


class IsOwnerOrStaffOrReadOnly(permissions.BasePermission):
    """Allow writes to project owners or staff while keeping reads open."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        return getattr(obj, "owner_id", None) == user.id


class HasProjectAccess(permissions.BasePermission):
    """Allow project reads for staff, owners, allow-listed users, or public."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        if request.method in permissions.SAFE_METHODS:
            if getattr(obj, "owner_id", None) == user.id:
                return True
            if getattr(obj, "is_public", False):
                return True
            return obj.allowed_users.filter(id=user.id).exists()
        return False


class CanReviewAccessRequest(permissions.BasePermission):
    """Allow access request review to staff or the owning PI."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or obj.project.owner_id == user.id)
        )
