from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta


class UserProfile(models.Model):
    """
    Extends Django's built-in User with role and display name per the ERD.
    Created automatically when a User is created via the post_save signal.
    """

    class Role(models.TextChoices):
        INVENTORY_CLERK = "inventory_clerk", "Inventory Clerk"
        SUPERVISOR = "supervisor", "Supervisor"
        ADMIN = "admin", "Admin"

    LOCKOUT_THRESHOLD = 5
    LOCKOUT_DURATION = timedelta(minutes=15)

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

    # Failed login tracking
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.email} ({self.role})"

    @property
    def is_locked(self):
        """Return True if the account is currently locked."""
        if self.locked_until and timezone.now() < self.locked_until:
            return True
        return False

    @property
    def lockout_remaining_minutes(self):
        """Return minutes remaining in lockout, or 0 if not locked."""
        if self.is_locked:
            delta = self.locked_until - timezone.now()
            return max(1, int(delta.total_seconds() / 60) + 1)
        return 0

    def register_failed_attempt(self):
        """Increment failed attempts; lock account if threshold reached."""
        # If a previous lockout has expired, reset counter first
        if self.locked_until and timezone.now() >= self.locked_until:
            self.failed_login_attempts = 0
            self.locked_until = None

        self.failed_login_attempts += 1
        if self.failed_login_attempts >= self.LOCKOUT_THRESHOLD:
            self.locked_until = timezone.now() + self.LOCKOUT_DURATION
        self.save(update_fields=["failed_login_attempts", "locked_until"])

    def reset_failed_attempts(self):
        """Clear failed attempts and lockout after a successful login."""
        if self.failed_login_attempts > 0 or self.locked_until:
            self.failed_login_attempts = 0
            self.locked_until = None
            self.save(update_fields=["failed_login_attempts", "locked_until"])


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create a UserProfile whenever a new User is saved."""
    if created:
        UserProfile.objects.get_or_create(user=instance)

