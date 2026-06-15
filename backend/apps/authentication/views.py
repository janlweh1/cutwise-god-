from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from .serializers import RegisterSerializer, UserSerializer, AdminUserSerializer
from .jwt_serializers import CustomTokenObtainPairSerializer
from .models import UserProfile
from .permissions import IsAdminUserRole
# ──────────────────────────────────────────────
# Admin: User Management
# ──────────────────────────────────────────────

class UserListView(APIView):
    """
    Admin-only: list all users or create a new one.
    GET  /auth/users/  — returns all users with profile info
    POST /auth/users/  — create a new user (delegates to RegisterSerializer)
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        users = User.objects.select_related("profile").all().order_by("date_joined")
        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"detail": "User created successfully."}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    """
    Admin-only: update or deactivate a specific user.
    PATCH /auth/users/{id}/            — update role / full_name
    POST  /auth/users/{id}/deactivate/ — toggle is_active
    """
    permission_classes = [IsAdminUserRole]

    def get_object(self, pk):
        try:
            return User.objects.select_related("profile").get(pk=pk)
        except User.DoesNotExist:
            return None

    def patch(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Prevent admin from downgrading themselves
        if user == request.user and request.data.get("role") != "admin":
            return Response(
                {"detail": "You cannot change your own role."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = getattr(user, "profile", None)
        if not profile:
            return Response({"detail": "User profile not found."}, status=status.HTTP_400_BAD_REQUEST)

        if "full_name" in request.data:
            profile.full_name = request.data["full_name"]
        if "role" in request.data:
            if request.data["role"] not in [r[0] for r in UserProfile.Role.choices]:
                return Response({"detail": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)
            profile.role = request.data["role"]
        profile.save()

        serializer = AdminUserSerializer(user)
        return Response(serializer.data)


class UserDeactivateView(APIView):
    """
    Admin-only: toggle a user's is_active status (deactivate / reactivate).
    POST /auth/users/{id}/deactivate/
    """
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        action = "reactivated" if user.is_active else "deactivated"
        return Response({"detail": f"User {action} successfully.", "is_active": user.is_active})


# ──────────────────────────────────────────────
# Self-service: Change Password
# ──────────────────────────────────────────────

class ChangePasswordView(APIView):
    """
    Authenticated user changes their own password.
    POST /auth/change-password/
    Body: { current_password, new_password }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not current_password or not new_password:
            return Response(
                {"detail": "Both current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save()
        return Response({"detail": "Password changed successfully."})



class RegisterView(generics.CreateAPIView):
    """Register a new user account."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint — returns access + refresh tokens, plus role and full_name.

    Extends the standard simplejwt view to use our custom serializer
    which embeds role and full_name in both the JWT and the response body.

    Also enforces server-side account lockout after 5 failed login attempts.
    """

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get("username", "").strip()

        # ── Pre-auth: check if account is locked ──────────────────────
        profile = None
        try:
            user_obj = User.objects.get(username=username)
            profile = getattr(user_obj, "profile", None)
        except User.DoesNotExist:
            # Also try by email
            try:
                user_obj = User.objects.get(email=username)
                profile = getattr(user_obj, "profile", None)
            except User.DoesNotExist:
                pass

        if profile and profile.is_locked:
            return Response(
                {
                    "detail": (
                        f"This account is temporarily locked due to too many failed login attempts. "
                        f"Please try again in {profile.lockout_remaining_minutes} minutes."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── Attempt authentication ────────────────────────────────────
        try:
            response = super().post(request, *args, **kwargs)
        except Exception:
            # Authentication failed — record the failure
            if profile:
                profile.register_failed_attempt()
                remaining = max(0, UserProfile.LOCKOUT_THRESHOLD - profile.failed_login_attempts)
                if profile.is_locked:
                    return Response(
                        {
                            "detail": (
                                "Too many failed login attempts. "
                                f"Your account has been locked for {profile.lockout_remaining_minutes} minutes."
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                else:
                    return Response(
                        {
                            "detail": (
                                f"Invalid email or password. "
                                f"You have {remaining} attempt{'s' if remaining != 1 else ''} remaining before account lockout."
                            )
                        },
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            # User not found — generic error (prevent user enumeration)
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ── Success — reset lockout counter ───────────────────────────
        if profile:
            profile.reset_failed_attempts()

        return response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def current_user(request):
    """Return the currently authenticated user's profile."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def forgot_password(request):
    """
    Initiate a password reset.

    Currently acknowledges the request but does not send an email.
    To enable real email resets, configure Django's EMAIL_BACKEND
    and call: django.contrib.auth.forms.PasswordResetForm(...).save(...)
    """
    email = request.data.get("email", "").strip()
    if not email:
        return Response(
            {"detail": "Email is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Always return success to prevent user enumeration
    # TODO: integrate SMTP here when email is configured
    return Response(
        {"detail": "If an account with that email exists, a reset link has been sent."},
        status=status.HTTP_200_OK,
    )

