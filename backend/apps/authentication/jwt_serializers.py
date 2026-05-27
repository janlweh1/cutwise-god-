"""
Custom JWT serializer that embeds role and full_name into the token payload.

This means the frontend can read the user's role directly from the JWT
without making an extra API call to /me/.
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT pair serializer to:
    1. Add `role` and `full_name` to the JWT payload itself.
    2. Return `role` and `full_name` in the login response body.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Embed profile fields in the JWT payload
        try:
            profile = user.profile
            token["role"] = profile.role
            token["full_name"] = profile.full_name
        except Exception:
            token["role"] = "employee"
            token["full_name"] = ""

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Also expose role and full_name in the HTTP response body
        try:
            profile = self.user.profile
            data["role"] = profile.role
            data["full_name"] = profile.full_name
        except Exception:
            data["role"] = "employee"
            data["full_name"] = ""

        return data
