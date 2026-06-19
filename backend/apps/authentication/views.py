from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.forms import PasswordResetForm
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
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
    POST /auth/users/  — create a new user (inactive) and send activation email
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        users = User.objects.select_related("profile").all().order_by("date_joined")
        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Mark account as inactive until user activates via email
            user.is_active = False
            user.save(update_fields=["is_active"])

            # Generate activation token
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)

            # Get role display name
            role_display_map = {
                "inventory_clerk": "Inventory Clerk",
                "supervisor": "Supervisor",
                "admin": "Admin",
            }
            profile = getattr(user, "profile", None)
            role_display = role_display_map.get(profile.role if profile else "", "Staff")
            full_name = profile.full_name if profile else ""

            # Send activation email
            try:
                send_mail(
                    subject="Activate your Otto Shoes IMS account",
                    message=(
                        f"Hi {full_name or user.email},\n\n"
                        f"An administrator has created an account for you with the role: {role_display}.\n\n"
                        f"Click the link below to set your password and activate your account:\n"
                        f"{settings.FRONTEND_URL}/activate/{uid}/{token}/\n\n"
                        f"This link expires in 7 days. If you did not expect this, you can ignore this email.\n\n"
                        f"— Otto Shoes Manufacturing System"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception as e:
                # If email fails, delete the user so admin can retry
                user.delete()
                return Response(
                    {"detail": f"Failed to send activation email: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            return Response(
                {"detail": "User created. An activation email has been sent to their inbox."},
                status=status.HTTP_201_CREATED,
            )
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
    Sends a real password reset email via Gmail SMTP.
    Always returns success to prevent user enumeration.
    """
    email = request.data.get("email", "").strip()
    if not email:
        return Response(
            {"detail": "Email is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Use Django's built-in PasswordResetForm for secure token generation
    form = PasswordResetForm({"email": email})
    if form.is_valid():
        form.save(
            request=request,
            use_https=False,
            from_email=settings.DEFAULT_FROM_EMAIL,
            email_template_name="registration/password_reset_email.html",
            subject_template_name="registration/password_reset_subject.txt",
            extra_email_context={
                "frontend_url": settings.FRONTEND_URL,
            },
        )

    # Always return success (prevents user enumeration)
    return Response(
        {"detail": "If an account with that email exists, a reset link has been sent."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def reset_password_confirm(request):
    """
    Validates the reset token and sets the new password.
    Body: { uid, token, new_password }
    """
    uid = request.data.get("uid", "")
    token = request.data.get("token", "")
    new_password = request.data.get("new_password", "")

    if not uid or not token or not new_password:
        return Response(
            {"detail": "uid, token, and new_password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 8:
        return Response(
            {"detail": "Password must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Decode the user id
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {"detail": "Reset link is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate the token
    if not default_token_generator.check_token(user, token):
        return Response(
            {"detail": "Reset link is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Set the new password
    user.set_password(new_password)
    user.save()

    return Response({"detail": "Password reset successfully. You can now log in."})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def activate_account(request):
    """
    Validates the activation token, sets the user's password, and activates the account.
    Body: { uid, token, password }
    """
    uid = request.data.get("uid", "")
    token = request.data.get("token", "")
    password = request.data.get("password", "")

    if not uid or not token or not password:
        return Response(
            {"detail": "uid, token, and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(password) < 8:
        return Response(
            {"detail": "Password must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Decode the user id
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {"detail": "This activation link is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate the token (works even for inactive users)
    if not default_token_generator.check_token(user, token):
        return Response(
            {"detail": "This activation link is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Set password and activate the account
    user.set_password(password)
    user.is_active = True
    user.save()

    return Response({"detail": "Account activated successfully. You can now log in."})
