from rest_framework import permissions

class IsAdminUserRole(permissions.BasePermission):
    """
    Allows access only to users with the 'admin' role in their profile.
    """

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, "profile") and
            request.user.profile.role == "admin"
        )


class IsAdminOrSupervisorUserRole(permissions.BasePermission):
    """
    Allows access to users with 'admin' or 'supervisor' roles in their profile.
    """

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, "profile") and
            request.user.profile.role in ["admin", "supervisor"]
        )

