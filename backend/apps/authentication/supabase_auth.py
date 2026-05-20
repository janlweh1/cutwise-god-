"""
Custom DRF authentication backend that validates Supabase JWT access tokens.

Usage:
    Set in settings.py REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']
"""

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User
from utils.supabase_client import get_supabase_client


class SupabaseJWTAuthentication(BaseAuthentication):
    """
    Authenticate incoming requests by verifying the Bearer token
    against the Supabase Auth API using the service-role client.

    On success, it returns (django_user, token_data) where django_user
    is a local User object synced from the Supabase user record.
    """

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None  # Let other auth backends handle it

        token = auth_header.split("Bearer ")[1].strip()
        if not token:
            return None

        # Validate the token against Supabase Auth
        try:
            supabase = get_supabase_client()
            user_response = supabase.auth.get_user(token)
        except Exception as e:
            raise AuthenticationFailed(f"Invalid or expired token: {e}")

        if not user_response or not user_response.user:
            raise AuthenticationFailed("Could not verify Supabase token.")

        sb_user = user_response.user
        supabase_uid = sb_user.id
        email = sb_user.email or ""
        metadata = sb_user.user_metadata or {}
        role = metadata.get("role", "employee")
        full_name = metadata.get("full_name", "")

        # Sync to a local Django User (create if missing)
        django_user, created = User.objects.get_or_create(
            username=supabase_uid,
            defaults={
                "email": email,
                "first_name": full_name[:30] if full_name else "",
                "is_active": True,
            },
        )

        if not created:
            # Keep email in sync
            changed = False
            if django_user.email != email:
                django_user.email = email
                changed = True
            if django_user.first_name != (full_name[:30] if full_name else ""):
                django_user.first_name = full_name[:30] if full_name else ""
                changed = True
            if changed:
                django_user.save(update_fields=["email", "first_name"])

        # Attach extra metadata so views can read role easily
        django_user.supabase_role = role
        django_user.supabase_full_name = full_name

        return (django_user, {"token": token, "role": role, "supabase_uid": supabase_uid})

    def authenticate_header(self, request):
        return "Bearer"
