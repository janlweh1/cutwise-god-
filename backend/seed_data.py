#!/usr/bin/env python
import os
import sys
import random
from datetime import datetime, timedelta
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.contrib.auth.models import User
from apps.inventory.models import Material, Supplier, AuditLog

def seed_audit_logs():
    print("Starting database seeding (adding 2,000+ audit log entries)...")
    
    # Get active users
    users = list(User.objects.all())
    if not users:
        print("No users found. Creating a default admin user...")
        default_user = User.objects.create_superuser("admin", "admin@cutwise.com", "admin123")
        users = [default_user]
        
    # Get materials to link in audit details
    materials = list(Material.objects.all())
    if not materials:
        print("No materials found in database. Please add materials first.")
        return
        
    actions = [
        (AuditLog.ActionType.MATERIAL_UPDATED, "Updated material {name}: quantity adjusted by {diff}"),
        (AuditLog.ActionType.STOCK_ADJUSTED, "Adjusted stock for {name}. Old Qty: {old}, New Qty: {new}"),
        (AuditLog.ActionType.CONFIG_UPDATED, "System configuration updated: modified low-stock threshold for {name}"),
    ]
    
    # Generate 2,010 log entries over the past 90 days
    start_date = datetime.now() - timedelta(days=90)
    
    audit_objs = []
    
    for i in range(2010):
        user = random.choice(users)
        material = random.choice(materials)
        action_type, detail_tpl = random.choice(actions)
        
        # Calculate random timestamp
        random_days = random.randint(0, 90)
        random_hours = random.randint(0, 23)
        random_minutes = random.randint(0, 59)
        log_date = start_date + timedelta(days=random_days, hours=random_hours, minutes=random_minutes)
        # Ensure aware datetime
        from django.utils import timezone
        aware_log_date = timezone.make_aware(log_date)
        
        # Generate realistic values
        diff = random.randint(-15, 15)
        if diff == 0:
            diff = 5
        old_qty = random.randint(20, 100)
        new_qty = old_qty + diff
        
        details = detail_tpl.format(
            name=material.material_name,
            diff=diff,
            old=old_qty,
            new=new_qty
        )
        
        audit_objs.append(
            AuditLog(
                user=user,
                username=user.profile.full_name or user.email or user.username,
                action=action_type,
                details=details,
                timestamp=aware_log_date
            )
        )
        
    # bulk_create bypasses individual save() calls and respects the manual timestamps
    AuditLog.objects.bulk_create(audit_objs)
    print(f"Successfully seeded {len(audit_objs)} audit log records into PostgreSQL database!")

if __name__ == "__main__":
    seed_audit_logs()
