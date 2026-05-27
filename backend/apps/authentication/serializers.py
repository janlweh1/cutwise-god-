from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for creating a new user account."""

    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(
        choices=UserProfile.Role.choices,
        default=UserProfile.Role.INVENTORY_CLERK,
        required=False,
    )
    full_name = serializers.CharField(max_length=255, default="", required=False)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "role", "full_name"]

    def create(self, validated_data):
        role = validated_data.pop("role", UserProfile.Role.INVENTORY_CLERK)
        full_name = validated_data.pop("full_name", "")

        user = User.objects.create_user(
            username=validated_data.get("username", validated_data.get("email", "")),
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=full_name[:30] if full_name else "",
        )

        # The signal creates the profile; update it with the given values
        profile = user.profile
        profile.role = role
        profile.full_name = full_name
        profile.save()

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for the UserProfile model."""

    class Meta:
        model = UserProfile
        fields = ["role", "full_name"]


class UserSerializer(serializers.ModelSerializer):
    """Serializer for the authenticated user, including profile fields."""

    role = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined", "role", "full_name"]
        read_only_fields = ["id", "date_joined"]

    def get_role(self, obj):
        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            return "employee"

    def get_full_name(self, obj):
        try:
            return obj.profile.full_name
        except UserProfile.DoesNotExist:
            return obj.first_name or ""
