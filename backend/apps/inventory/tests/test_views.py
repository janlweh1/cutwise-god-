import pytest
from unittest.mock import patch
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from apps.inventory.models import Supplier, Material, ScrapInventory, AuditLog

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def auth_user():
    user = User.objects.create(
        username="bc649af0-5266-4631-938b-fdfa54d2bcf3",
        email="employee@example.com",
        first_name="John Employee"
    )
    user.supabase_role = "employee"
    user.supabase_full_name = "John Employee"
    return user

@pytest.fixture
def authenticated_client(api_client, auth_user):
    # Patch SupabaseJWTAuthentication.authenticate to bypass external network calls
    with patch("apps.authentication.supabase_auth.SupabaseJWTAuthentication.authenticate") as mock_auth:
        mock_auth.return_value = (
            auth_user,
            {
                "token": "mock-jwt-token",
                "role": "employee",
                "supabase_uid": "bc649af0-5266-4631-938b-fdfa54d2bcf3"
            }
        )
        api_client.credentials(HTTP_AUTHORIZATION="Bearer mock-jwt-token")
        yield api_client


@pytest.mark.django_db
class TestAuthenticationProtection:
    def test_unauthenticated_requests_are_rejected(self, api_client):
        url = reverse("inventory:supplier-list")
        response = api_client.get(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestSupplierEndpoints:
    def test_list_suppliers(self, authenticated_client):
        Supplier.objects.create(name="Supplier A")
        Supplier.objects.create(name="Supplier B")

        url = reverse("inventory:supplier-list")
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        
        # Checking pagination results structure
        data = response.data
        results = data.get("results", data)
        assert len(results) == 2

    def test_create_supplier(self, authenticated_client):
        url = reverse("inventory:supplier-list")
        payload = {
            "name": "Supplier C",
            "contact_person": "Charles",
            "email": "charles@supplierc.com"
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Supplier C"
        
        # Verify supplier_added audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.SUPPLIER_ADDED,
            username="John Employee"
        ).exists()


@pytest.mark.django_db
class TestMaterialEndpoints:
    @pytest.fixture
    def supplier(self):
        return Supplier.objects.create(name="Main Supplier")

    def test_create_material_success_and_logs(self, authenticated_client, supplier):
        url = reverse("inventory:material-list")
        payload = {
            "name": "Full Grain Leather",
            "material_type": "cowhide",
            "size": "20 sqft",
            "quantity": 15,
            "unit_cost": 250.00,
            "supplier": str(supplier.id),
            "reorder_level": 5
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Full Grain Leather"
        
        # Verify material_added audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.MATERIAL_ADDED,
            username="John Employee"
        ).exists()

    def test_create_material_duplicate_validation(self, authenticated_client, supplier):
        Material.objects.create(
            name="Suede Brown",
            material_type=Material.MaterialType.SUEDE,
            supplier=supplier
        )
        url = reverse("inventory:material-list")
        payload = {
            "name": "Suede Brown",
            "material_type": "suede",
            "supplier": str(supplier.id),
            "quantity": 10,
            "unit_cost": 100.00
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "non_field_errors" in response.data or "detail" in response.data or any("exists" in val[0] for val in response.data.values() if isinstance(val, list))

    def test_filter_material_by_stock_status(self, authenticated_client, supplier):
        # 1. In stock (qty = 50, reorder = 10)
        Material.objects.create(name="Mat In Stock", material_type="cowhide", quantity=50, reorder_level=10, supplier=supplier)
        # 2. Low stock (qty = 5, reorder = 10)
        Material.objects.create(name="Mat Low Stock", material_type="cowhide", quantity=5, reorder_level=10, supplier=supplier)
        # 3. Out of stock (qty = 0, reorder = 10)
        Material.objects.create(name="Mat Out Of Stock", material_type="cowhide", quantity=0, reorder_level=10, supplier=supplier)

        url = reverse("inventory:material-list")
        
        # Low stock filter
        response = authenticated_client.get(url, {"stock_status": "low_stock"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["name"] == "Mat Low Stock"

        # Out of stock filter
        response = authenticated_client.get(url, {"stock_status": "out_of_stock"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["name"] == "Mat Out Of Stock"

        # In stock filter
        response = authenticated_client.get(url, {"stock_status": "in_stock"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["name"] == "Mat In Stock"

    def test_search_materials(self, authenticated_client, supplier):
        Material.objects.create(name="Zebra Leather pattern", material_type="cowhide", supplier=supplier)
        Material.objects.create(name="Crocodile synthetic", material_type="synthetic", supplier=supplier)

        url = reverse("inventory:material-list")
        
        response = authenticated_client.get(url, {"search": "Zebra"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["name"] == "Zebra Leather pattern"

    def test_update_material(self, authenticated_client, supplier):
        mat = Material.objects.create(name="Nappa Soft", material_type="nappa", quantity=10, supplier=supplier)
        url = reverse("inventory:material-detail", kwargs={"pk": mat.id})
        
        payload = {"quantity": 25}
        response = authenticated_client.patch(url, payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["quantity"] == 25
        
        # Verify material_updated audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.MATERIAL_UPDATED,
            username="John Employee"
        ).exists()

    def test_delete_material(self, authenticated_client, supplier):
        mat = Material.objects.create(name="Obsolete Material", material_type="other", supplier=supplier)
        url = reverse("inventory:material-detail", kwargs={"pk": mat.id})
        
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify material_deleted audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.MATERIAL_DELETED,
            username="John Employee"
        ).exists()


@pytest.mark.django_db
class TestScrapInventoryEndpoints:
    def test_create_scrap_auto_computes_value(self, authenticated_client):
        url = reverse("inventory:scrap-list")
        payload = {
            "source_batch": "BATCH-2026-X",
            "material_type": "cowhide",  # Rate is 50
            "weight_kg": 2.500,
            "source": "conversion"
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        
        # Value should be weight (2.5) * rate (50) = 125.00
        assert float(response.data["value"]) == 125.00
        
        # Verify scrap_converted audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.SCRAP_CONVERTED,
            username="John Employee"
        ).exists()


@pytest.mark.django_db
class TestAuditLogEndpoints:
    def test_audit_logs_read_only(self, authenticated_client):
        AuditLog.objects.create(action="supplier_added", username="System", details="Action details")
        url = reverse("inventory:audit-log-list")
        
        # GET should succeed
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) == 1
        
        # POST/PUT should be disallowed (read-only viewset)
        response = authenticated_client.post(url, {"username": "FakeUser"})
        assert response.status_code in [status.HTTP_405_METHOD_NOT_ALLOWED, status.HTTP_403_FORBIDDEN]
