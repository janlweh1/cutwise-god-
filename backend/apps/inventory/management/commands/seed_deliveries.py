from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.inventory.models import Supplier, Material, Scrap, ScrapSale, AuditLog, Delivery
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = "Seed materials, deliveries, and audit logs to match design mockup dynamically."

    def handle(self, *args, **options):
        # 1. Clear existing data in correct dependency order
        self.stdout.write("Clearing existing inventory tables...")
        AuditLog.objects.all().delete()
        ScrapSale.objects.all().delete()
        Scrap.objects.all().delete()
        Delivery.objects.all().delete()
        Material.objects.all().delete()
        Supplier.objects.all().delete()

        # 2. Get or create users
        clerk_user = User.objects.filter(username="clerk@otto.com").first()
        if not clerk_user:
            clerk_user = User.objects.filter(is_active=True).first()
            if not clerk_user:
                clerk_user = User.objects.create_user(
                    username="clerk@otto.com",
                    email="clerk@otto.com",
                    password="password123",
                    first_name="Inventory Clerk"
                )

        # 3. Create Suppliers
        self.stdout.write("Creating suppliers...")
        beta_supplier = Supplier.objects.create(
            name="Beta Supplier",
            contact_person="Jane Doe",
            phone="+639111222333",
            email="beta@supplier.com"
        )
        gamma_supplier = Supplier.objects.create(
            name="Gamma Supplier",
            contact_person="Bob Jones",
            phone="+639222333444",
            email="gamma@supplier.com"
        )
        alpha_supplier = Supplier.objects.create(
            name="Alpha Leather Co",
            contact_person="Alice Smith",
            phone="+639123456789",
            email="alice@alphaleather.com"
        )
        artisan_supplier = Supplier.objects.create(
            name="Artisan Crafts Co.",
            contact_person="Clara Oswald",
            phone="+639333444555",
            email="clara@artisan.com"
        )

        # 4. Create Materials matching screenshot (total: 415 items, 4 low stock)
        self.stdout.write("Creating materials...")
        mat1 = Material.objects.create(
            material_name="Cowhide Black Grade A",
            material_type=Material.MaterialType.COWHIDE,
            size="12 sqft",
            quantity=3,
            unit_cost=150.00,
            min_stock=10,
            supplier=beta_supplier,
            added_by=clerk_user
        )
        mat2 = Material.objects.create(
            material_name="Rubber Sole Size 42",
            material_type=Material.MaterialType.RUBBER,
            size="1 pair",
            quantity=5,
            unit_cost=80.00,
            min_stock=20,
            supplier=gamma_supplier,
            added_by=clerk_user
        )
        mat3 = Material.objects.create(
            material_name="Goatskin Brown",
            material_type=Material.MaterialType.GOATSKIN,
            size="8 sqft",
            quantity=2,
            unit_cost=120.00,
            min_stock=8,
            supplier=beta_supplier,
            added_by=clerk_user
        )
        mat4 = Material.objects.create(
            material_name="Adhesive Contact Cement",
            material_type=Material.MaterialType.ADHESIVE,
            size="500ml",
            quantity=1,
            unit_cost=250.00,
            min_stock=5,
            supplier=gamma_supplier,
            added_by=clerk_user
        )
        # Bulk material to make sum equal 415
        Material.objects.create(
            material_name="Premium Leather Offcuts (Bulk)",
            material_type=Material.MaterialType.COWHIDE,
            size="Bulk Box",
            quantity=404,
            unit_cost=25.00,
            min_stock=10,
            supplier=alpha_supplier,
            added_by=clerk_user
        )

        # 5. Create Deliveries (3 Pending, 1 Received)
        self.stdout.write("Creating deliveries...")
        Delivery.objects.create(
            batch_number="Batch #2410",
            material_name="Cowhide Black Grade A",
            quantity=100,
            size="12 sqft",
            supplier=beta_supplier,
            status=Delivery.DeliveryStatus.PENDING
        )
        Delivery.objects.create(
            batch_number="Batch #2411",
            material_name="Goatskin Brown",
            quantity=50,
            size="8 sqft",
            supplier=beta_supplier,
            status=Delivery.DeliveryStatus.PENDING
        )
        Delivery.objects.create(
            batch_number="Batch #2412",
            material_name="Rubber Sole Size 42",
            quantity=200,
            size="1 pair",
            supplier=gamma_supplier,
            status=Delivery.DeliveryStatus.PENDING
        )
        Delivery.objects.create(
            batch_number="Batch #2409",
            material_name="Raw Cowhide",
            quantity=120,
            size="15 sqft",
            supplier=alpha_supplier,
            status=Delivery.DeliveryStatus.RECEIVED,
            received_at=timezone.now() - datetime.timedelta(hours=5),
            received_by=clerk_user
        )

        # 6. Create AuditLogs matching the Recent Activity in screenshot
        self.stdout.write("Creating audit logs...")
        # Activity 1: Scrap Sale (2 hours ago)
        AuditLog.objects.create(
            user=clerk_user,
            username=clerk_user.profile.full_name or "Inventory Clerk",
            action=AuditLog.ActionType.SCRAP_SOLD,
            details="Sold 4.2kg Goatskin scrap to Artisan Crafts Co.",
            timestamp=timezone.now() - datetime.timedelta(hours=2)
        )
        # Activity 2: Delivery Received (5 hours ago)
        AuditLog.objects.create(
            user=clerk_user,
            username=clerk_user.profile.full_name or "Inventory Clerk",
            action=AuditLog.ActionType.DELIVERY_RECEIVED,
            details="Raw Cowhide delivery received - Batch #2409",
            timestamp=timezone.now() - datetime.timedelta(hours=5)
        )
        # Activity 3: Stock check completed (8 hours ago)
        AuditLog.objects.create(
            user=clerk_user,
            username=clerk_user.profile.full_name or "Inventory Clerk",
            action=AuditLog.ActionType.STOCK_ADJUSTED,
            details="Stock check completed - 415 items verified",
            timestamp=timezone.now() - datetime.timedelta(hours=8)
        )
        # Activity 4: Scrap Sale (1 day ago)
        AuditLog.objects.create(
            user=clerk_user,
            username=clerk_user.profile.full_name or "Inventory Clerk",
            action=AuditLog.ActionType.SCRAP_SOLD,
            details="Sold 12kg Cowhide offcuts to Leather Goods Ltd",
            timestamp=timezone.now() - datetime.timedelta(days=1)
        )

        self.stdout.write(self.style.SUCCESS("Database seeded successfully for Clerk dashboard!"))
