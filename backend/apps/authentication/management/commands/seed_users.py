"""
Management command: seed_users

Creates the three test user accounts with correct ERD roles.

Usage:
    python manage.py seed_users
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.authentication.models import UserProfile


class Command(BaseCommand):
    help = "Seed the database with the three default test user accounts."

    USERS = [
        {
            "email": "clerk@otto.com",
            "username": "clerk@otto.com",
            "password": "password123",
            "role": UserProfile.Role.INVENTORY_CLERK,
            "full_name": "Inventory Clerk",
        },
        {
            "email": "supervisor@otto.com",
            "username": "supervisor@otto.com",
            "password": "password123",
            "role": UserProfile.Role.SUPERVISOR,
            "full_name": "Supervisor",
        },
        {
            "email": "admin@otto.com",
            "username": "admin@otto.com",
            "password": "password123",
            "role": UserProfile.Role.ADMIN,
            "full_name": "Admin",
        },
    ]

    def handle(self, *args, **options):
        for user_data in self.USERS:
            user, created = User.objects.get_or_create(
                username=user_data["username"],
                defaults={
                    "email": user_data["email"],
                    "first_name": user_data["full_name"],
                    "is_active": True,
                },
            )

            if created:
                user.set_password(user_data["password"])
                user.save()
                self.stdout.write(f"  Created user: {user_data['email']}")
            else:
                self.stdout.write(f"  Already exists: {user_data['email']}")

            # Update profile
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = user_data["role"]
            profile.full_name = user_data["full_name"]
            profile.save()
            self.stdout.write(
                self.style.SUCCESS(f"  [OK] {user_data['email']} -> role: {user_data['role']}")
            )

        self.stdout.write(self.style.SUCCESS("\nSeed complete! Test accounts ready."))
        self.stdout.write("  clerk@otto.com       / password123  (Inventory Clerk)")
        self.stdout.write("  supervisor@otto.com  / password123  (Supervisor)")
        self.stdout.write("  admin@otto.com       / password123  (Admin)")
