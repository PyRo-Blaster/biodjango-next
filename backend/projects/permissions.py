from rest_framework import permissions

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow admins to edit objects.
    Read permissions are allowed to any request.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff

class HasProjectAccess(permissions.BasePermission):
    """
    Custom permission to handle project access.
    - Admins can do everything.
    - Allowed users can view (GET).
    - Others are denied.
    """
    def has_object_permission(self, request, view, obj):
        # Admins always have access
        if request.user.is_staff:
            return True
        
        # Check if project is public (future proofing)
        if hasattr(obj, 'is_public') and obj.is_public:
            return request.method in permissions.SAFE_METHODS

        # Check if user is in allowed_users
        if request.method in permissions.SAFE_METHODS:
            return obj.allowed_users.filter(id=request.user.id).exists()
            
        return False
