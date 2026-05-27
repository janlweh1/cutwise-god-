from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    """
    Extends Django's built-in User with role and display name per the ERD.
    Created automatically when a User is created via the post_save signal.
    """

    class Role(models.TextChoices):
        INVENTORY_CLERK = "inventory_clerk", "Inventory Clerk"
        SUPERVISOR = "supervisor", "Supervisor"
        ADMIN = "admin", "Admin"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.INVENTORY_CLERK,
    )
    full_name = models.CharField(max_length=255, blank=True, default="")

    def __str__(self):
        return f"{self.user.email} ({self.role})"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create a UserProfile whenever a new User is saved."""
    if created:
        UserProfile.objects.get_or_create(user=instance)
