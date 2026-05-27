import pytest
from django.db import IntegrityError, transaction
from apps.inventory.models import Supplier, Material, Scrap, ScrapSale, AuditLog

@pytest.mark.django_db
class TestSupplierModel:
    def test_supplier_creation(self):
        supplier = Supplier.objects.create(
            name="Alpha Leather Co",
            contact_person="Alice Smith",
            phone="+639123456789",
            email="alice@alphaleather.com"
        )
        assert supplier.name == "Alpha Leather Co"
        assert supplier.contact_person == "Alice Smith"
        assert str(supplier) == "Alpha Leather Co"


@pytest.mark.django_db
class TestMaterialModel:
    @pytest.fixture
    def supplier(self):
        return Supplier.objects.create(name="Beta Supplier")

    def test_material_creation_and_properties(self, supplier):
        material = Material.objects.create(
            material_name="Premium Cowhide Black",
            material_type=Material.MaterialType.COWHIDE,
            size="15 sqft",
            quantity=50,
            unit_cost=120.50,
            supplier=supplier,
            min_stock=10
        )
        assert material.material_name == "Premium Cowhide Black"
        assert material.material_type == "cowhide"
        assert material.quantity == 50
        assert material.unit_cost == 120.50
        assert str(material) == "Premium Cowhide Black (Cowhide)"
        assert material.total_value == 50 * 120.50

    def test_stock_status_property(self, supplier):
        # In stock
        material = Material.objects.create(
            material_name="Mat 1",
            material_type=Material.MaterialType.SUEDE,
            quantity=20,
            min_stock=10,
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
            material_name="Shared Name",
            material_type=Material.MaterialType.COWHIDE,
            supplier=supplier
        )
        # Creating another with same name, type, and supplier should fail
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Material.objects.create(
                    material_name="Shared Name",
                    material_type=Material.MaterialType.COWHIDE,
                    supplier=supplier
                )

        # But it should pass if supplier is different
        other_supplier = Supplier.objects.create(name="Gamma Supplier")
        Material.objects.create(
            material_name="Shared Name",
            material_type=Material.MaterialType.COWHIDE,
            supplier=other_supplier
        )

        # Or if material type is different
        Material.objects.create(
            material_name="Shared Name",
            material_type=Material.MaterialType.GOATSKIN,
            supplier=supplier
        )


@pytest.mark.django_db
class TestScrapAndScrapSaleModels:
    @pytest.fixture
    def material(self):
        supplier = Supplier.objects.create(name="Supplier X")
        return Material.objects.create(
            material_name="Raw Leather",
            material_type=Material.MaterialType.COWHIDE,
            supplier=supplier,
            quantity=100
        )

    def test_scrap_creation(self, material):
        scrap = Scrap.objects.create(
            material=material,
            weight_kg=12.500,
            status=Scrap.ScrapStatus.AVAILABLE
        )
        assert scrap.material == material
        assert scrap.weight_kg == 12.500
        assert scrap.status == Scrap.ScrapStatus.AVAILABLE
        assert f"Scrap from Raw Leather" in str(scrap)
        assert f"12.5" in str(scrap)
        assert f"available" in str(scrap)

    def test_scrap_sale_creation(self, material):
        scrap = Scrap.objects.create(
            material=material,
            weight_kg=10.0,
            status=Scrap.ScrapStatus.AVAILABLE
        )
        sale = ScrapSale.objects.create(
            scrap=scrap,
            quantity_sold=5,
            sale_price_per_kg=150.00,
            total_amount=750.00,
            profit=500.00
        )
        assert sale.scrap == scrap
        assert sale.quantity_sold == 5
        assert sale.sale_price_per_kg == 150.00
        assert sale.total_amount == 750.00
        assert sale.profit == 500.00
        assert "Sale of Scrap from Raw Leather" in str(sale)


@pytest.mark.django_db
class TestAuditLogModel:
    def test_audit_log_creation(self):
        log = AuditLog.objects.create(
            username="John Clerk",
            action=AuditLog.ActionType.MATERIAL_ADDED,
            details="Added material: Raw Leather (Cowhide) — Qty: 50"
        )
        assert log.username == "John Clerk"
        assert log.action == "material_added"
        assert "John Clerk — Material Added" in str(log)
