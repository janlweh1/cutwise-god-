from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer
from .jwt_serializers import CustomTokenObtainPairSerializer
from .models import UserProfile


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

