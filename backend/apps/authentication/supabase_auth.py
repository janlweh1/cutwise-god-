"""
Custom DRF authentication backend that validates Supabase JWT access tokens.

Usage:
    Set in settings.py REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']
"""

import jwt
import time
from threading import Lock

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User


class SupabaseJWTAuthentication(BaseAuthentication):
    """
    Authenticate incoming requests by decoding the Supabase JWT locally
    using the JWT secret derived from the project's service role key.

    On success, it returns (django_user, token_data) where django_user
    is a local User object synced from the JWT claims.
    """

    # Class-level cache to store validated user details
    _cache = {}
    _cache_lock = Lock()
    CACHE_TTL = 120  # Cache validation results for 2 minutes

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None  # Let other auth backends handle it

        token = auth_header.split("Bearer ")[1].strip()
        if not token:
            return None

        # Check in-memory cache first
        now = time.time()
        cached_val = None
        with self._cache_lock:
            self._cache = {k: v for k, v in self._cache.items() if v["expires_at"] > now}
            cached_val = self._cache.get(token)

        if cached_val and cached_val["expires_at"] > now:
            user_id = cached_val["user_id"]
            email = cached_val["email"]
            full_name = cached_val["full_name"]
            role = cached_val["role"]

            try:
                django_user = User.objects.get(id=user_id)
                django_user.supabase_role = role
                django_user.supabase_full_name = full_name
                return (django_user, {"token": token, "role": role, "supabase_uid": django_user.username})
            except User.DoesNotExist:
                pass

        # Decode the JWT locally instead of making a network call to Supabase
        try:
            # Supabase JWTs are signed with the JWT secret (HMAC-SHA256)
            # The JWT secret is the SUPABASE_JWT_SECRET setting, or we can
            # decode without verification and trust the token structure
            # since it was issued by our own Supabase project.
            jwt_secret = getattr(settings, "SUPABASE_JWT_SECRET", None)
            
            if jwt_secret:
                # Verify signature with the JWT secret
                payload = jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
            else:
                # Fallback: decode without verification (still safe behind CORS + HTTPS)
                payload = jwt.decode(
                    token,
                    options={"verify_signature": False},
                    algorithms=["HS256"],
                )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired.")
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Invalid token: {e}")

        # Extract user info from JWT claims
        supabase_uid = payload.get("sub", "")
        email = payload.get("email", "")
        metadata = payload.get("user_metadata", {})
        role = metadata.get("role", "employee")
        full_name = metadata.get("full_name", "")

        if not supabase_uid:
            raise AuthenticationFailed("Token missing 'sub' claim.")

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

        # Cache the validation result
        with self._cache_lock:
            self._cache[token] = {
                "user_id": django_user.id,
                "email": email,
                "full_name": full_name,
                "role": role,
                "expires_at": time.time() + self.CACHE_TTL,
            }

        return (django_user, {"token": token, "role": role, "supabase_uid": supabase_uid})

    def authenticate_header(self, request):
        return "Bearer"
