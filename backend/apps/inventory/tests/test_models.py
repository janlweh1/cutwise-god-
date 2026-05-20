import pytest
from django.db import IntegrityError, transaction
from apps.inventory.models import Supplier, Material, ScrapInventory, AuditLog

@pytest.mark.django_db
class TestSupplierModel:
    def test_supplier_creation(self):
        supplier = Supplier.objects.create(
            name="Alpha Leather Co",
            contact_person="Alice Smith",
            phone="+639123456789",
            email="alice@alphaleather.com",
            address="123 Leather Lane, Bulacan"
        )
        assert supplier.name == "Alpha Leather Co"
        assert supplier.contact_person == "Alice Smith"
        assert str(supplier) == "Alpha Leather Co"
        assert supplier.is_active is True

    def test_supplier_unique_name(self):
        Supplier.objects.create(name="Unique Supplier")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Supplier.objects.create(name="Unique Supplier")


@pytest.mark.django_db
class TestMaterialModel:
    @pytest.fixture
    def supplier(self):
        return Supplier.objects.create(name="Beta Supplier")

    def test_material_creation_and_properties(self, supplier):
        material = Material.objects.create(
            name="Premium Cowhide Black",
            material_type=Material.MaterialType.COWHIDE,
            size="15 sqft",
            quantity=50,
            unit_cost=120.50,
            supplier=supplier,
            reorder_level=10
        )
        assert material.name == "Premium Cowhide Black"
        assert material.material_type == "cowhide"
        assert material.quantity == 50
        assert material.unit_cost == 120.50
        assert str(material) == "Premium Cowhide Black (Cowhide)"
        assert material.total_value == 50 * 120.50

    def test_stock_status_property(self, supplier):
        # In stock
        material = Material.objects.create(
            name="Mat 1",
            material_type=Material.MaterialType.SUEDE,
            quantity=20,
            reorder_level=10,
            supplier=supplier
        )
        assert material.stock_status == Material.StockStatus.IN_STOCK

        # Low stock
        material.quantity = 10
        material.save()
        assert material.stock_status == Material.StockStatus.LOW_STOCK

        material.quantity = 5
        material.save()
        assert material.stock_status == Material.StockStatus.LOW_STOCK

        # Out of stock
        material.quantity = 0
        material.save()
        assert material.stock_status == Material.StockStatus.OUT_OF_STOCK

    def test_unique_material_per_supplier_constraint(self, supplier):
        Material.objects.create(
            name="Shared Name",
            material_type=Material.MaterialType.COWHIDE,
            supplier=supplier
        )
        # Creating another with same name, type, and supplier should fail
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Material.objects.create(
                    name="Shared Name",
                    material_type=Material.MaterialType.COWHIDE,
                    supplier=supplier
                )

        # But it should pass if supplier is different
        other_supplier = Supplier.objects.create(name="Gamma Supplier")
        Material.objects.create(
            name="Shared Name",
            material_type=Material.MaterialType.COWHIDE,
            supplier=other_supplier
        )

        # Or if material type is different
        Material.objects.create(
            name="Shared Name",
            material_type=Material.MaterialType.GOATSKIN,
            supplier=supplier
        )


@pytest.mark.django_db
class TestScrapInventoryModel:
    def test_scrap_creation(self):
        scrap = ScrapInventory.objects.create(
            source_batch="BATCH-2026-001",
            material_type=Material.MaterialType.COWHIDE,
            weight_kg=12.500,
            value=625.00,
            source=ScrapInventory.ScrapSource.CUTTING,
            notes="Leftover from pattern cutting"
        )
        assert scrap.source_batch == "BATCH-2026-001"
        assert scrap.material_type == "cowhide"
        assert scrap.weight_kg == 12.500
        assert scrap.value == 625.00
        assert scrap.source == "cutting"
        assert str(scrap) == f"Scrap Cowhide — {scrap.weight_kg} kg"


@pytest.mark.django_db
class TestAuditLogModel:
    def test_audit_log_creation(self):
        log = AuditLog.objects.create(
            username="John Employee",
            action=AuditLog.ActionType.MATERIAL_ADDED,
            details="Added material: Full Grain Cowhide (Cowhide) — Qty: 50"
        )
        assert log.username == "John Employee"
        assert log.action == "material_added"
        assert "John Employee — Material Added" in str(log)
