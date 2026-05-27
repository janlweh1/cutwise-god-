from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer
from .jwt_serializers import CustomTokenObtainPairSerializer


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
    """

    serializer_class = CustomTokenObtainPairSerializer


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
