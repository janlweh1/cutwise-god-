import pytest
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from apps.inventory.models import Supplier, Material, Scrap, ScrapSale, AuditLog
from apps.authentication.models import UserProfile

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def auth_user():
    user = User.objects.create(
        username="clerk@otto.com",
        email="clerk@otto.com"
    )
    # The profile is created via signal. Let's customize it.
    profile = user.profile
    profile.role = UserProfile.Role.INVENTORY_CLERK
    profile.full_name = "John Employee"
    profile.save()
    return user

@pytest.fixture
def authenticated_client(api_client, auth_user):
    token = RefreshToken.for_user(auth_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


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
        
        data = response.data
        results = data.get("results", data)
        assert len(results) == 2

    def test_create_supplier(self, authenticated_client):
        url = reverse("inventory:supplier-list")
        payload = {
            "name": "Supplier C",
            "contact_person": "Charles",
            "email": "charles@supplierc.com",
            "address": "123 Leather Street, Manila"
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Supplier C"
        assert response.data["address"] == "123 Leather Street, Manila"

        # Verify in database
        supp = Supplier.objects.get(name="Supplier C")
        assert supp.address == "123 Leather Street, Manila"
        
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
            "material_name": "Full Grain Leather",
            "material_type": "cowhide",
            "size": "20 sqft",
            "quantity": 15,
            "unit_cost": 250.00,
            "supplier": str(supplier.id),
            "min_stock": 5
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["material_name"] == "Full Grain Leather"
        
        # Verify material_added audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.MATERIAL_ADDED,
            username="John Employee"
        ).exists()

    def test_create_material_duplicate_validation(self, authenticated_client, supplier):
        Material.objects.create(
            material_name="Suede Brown",
            material_type=Material.MaterialType.SUEDE,
            supplier=supplier
        )
        url = reverse("inventory:material-list")
        payload = {
            "material_name": "Suede Brown",
            "material_type": "suede",
            "supplier": str(supplier.id),
            "quantity": 10,
            "unit_cost": 100.00
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_material_by_stock_status(self, authenticated_client, supplier):
        # 1. In stock (qty = 50, min_stock = 10)
        Material.objects.create(material_name="Mat In Stock", material_type="cowhide", quantity=50, min_stock=10, supplier=supplier)
        # 2. Low stock (qty = 5, min_stock = 10)
        Material.objects.create(material_name="Mat Low Stock", material_type="cowhide", quantity=5, min_stock=10, supplier=supplier)
        # 3. Out of stock (qty = 0, min_stock = 10)
        Material.objects.create(material_name="Mat Out Of Stock", material_type="cowhide", quantity=0, min_stock=10, supplier=supplier)

        url = reverse("inventory:material-list")
        
        # Low stock filter
        response = authenticated_client.get(url, {"stock_status": "low_stock"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["material_name"] == "Mat Low Stock"

        # Out of stock filter
        response = authenticated_client.get(url, {"stock_status": "out_of_stock"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["material_name"] == "Mat Out Of Stock"

        # In stock filter
        response = authenticated_client.get(url, {"stock_status": "in_stock"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["material_name"] == "Mat In Stock"

    def test_search_materials(self, authenticated_client, supplier):
        Material.objects.create(material_name="Zebra Leather pattern", material_type="cowhide", supplier=supplier)
        Material.objects.create(material_name="Crocodile synthetic", material_type="synthetic", supplier=supplier)

        url = reverse("inventory:material-list")
        
        response = authenticated_client.get(url, {"search": "Zebra"})
        results = response.data.get("results", response.data)
        assert len(results) == 1
        assert results[0]["material_name"] == "Zebra Leather pattern"

    def test_update_material(self, authenticated_client, supplier):
        mat = Material.objects.create(material_name="Nappa Soft", material_type="nappa", quantity=10, supplier=supplier)
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
        mat = Material.objects.create(material_name="Obsolete Material", material_type="other", supplier=supplier)
        url = reverse("inventory:material-detail", kwargs={"pk": mat.id})
        
        response = authenticated_client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify material_deleted audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.MATERIAL_DELETED,
            username="John Employee"
        ).exists()


@pytest.mark.django_db
class TestScrapEndpoints:
    @pytest.fixture
    def material(self):
        supplier = Supplier.objects.create(name="Supplier S")
        return Material.objects.create(
            material_name="Suede Cut",
            material_type=Material.MaterialType.SUEDE,
            supplier=supplier,
            quantity=10
        )

    def test_create_scrap_and_sale(self, authenticated_client, material):
        # 1. Create Scrap
        url = reverse("inventory:scrap-list")
        payload = {
            "material": str(material.id),
            "weight_kg": 3.450,
            "status": "available"
        }
        response = authenticated_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        scrap_id = response.data["id"]
        
        # Verify scrap_recorded audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.SCRAP_RECORDED,
            username="John Employee"
        ).exists()

        # 2. Sell Scrap
        sale_url = reverse("inventory:scrap-sale-list")
        sale_payload = {
            "scrap": scrap_id,
            "quantity_sold": 1,
            "sale_price_per_kg": 100.00,
            "total_amount": 345.00,
            "profit": 200.00
        }
        sale_response = authenticated_client.post(sale_url, sale_payload, format="json")
        assert sale_response.status_code == status.HTTP_201_CREATED
        
        # Check scrap is now SOLD
        assert Scrap.objects.get(id=scrap_id).status == Scrap.ScrapStatus.SOLD
        
        # Verify scrap_sold audit log is created
        assert AuditLog.objects.filter(
            action=AuditLog.ActionType.SCRAP_SOLD,
            username="John Employee"
        ).exists()


@pytest.mark.django_db
class TestAuditLogEndpoints:
    @pytest.fixture
    def admin_client(self, api_client):
        admin = User.objects.create(
            username="admin@otto.com",
            email="admin@otto.com"
        )
        profile = admin.profile
        profile.role = UserProfile.Role.ADMIN
        profile.full_name = "System Admin"
        profile.save()
        token = RefreshToken.for_user(admin)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
        return api_client

    def test_audit_logs_read_only_for_admin(self, admin_client):
        AuditLog.objects.create(action="supplier_added", username="System", details="Action details")
        url = reverse("inventory:audit-log-list")
        
        # GET should succeed for admin
        response = admin_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        results = response.data.get("results", response.data)
        assert len(results) == 1
        
        # POST/PUT should be disallowed (read-only viewset)
        response = admin_client.post(url, {"username": "FakeUser"})
        assert response.status_code in [status.HTTP_405_METHOD_NOT_ALLOWED, status.HTTP_403_FORBIDDEN]

    def test_audit_logs_forbidden_for_clerk(self, authenticated_client):
        url = reverse("inventory:audit-log-list")
        
        # GET should fail with 403 Forbidden for a clerk
        response = authenticated_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_audit_logs_filtering(self, admin_client):
        # Create different audit logs
        AuditLog.objects.create(action="material_added", username="John Clerk", details="Added Full Grain")
        AuditLog.objects.create(action="material_deleted", username="Alice Admin", details="Deleted scrap")
        
        url = reverse("inventory:audit-log-list")
        
        # Filter by username
        res = admin_client.get(url, {"username": "John Clerk"})
        results = res.data.get("results", res.data)
        assert len(results) == 1
        assert results[0]["username"] == "John Clerk"

        # Filter by action
        res = admin_client.get(url, {"action": "material_deleted"})
        results = res.data.get("results", res.data)
        assert len(results) == 1
        assert results[0]["action"] == "material_deleted"

        # Filter by date
        from django.utils import timezone
        today_str = timezone.now().strftime("%Y-%m-%d")
        res = admin_client.get(url, {"date": today_str})
        results = res.data.get("results", res.data)
        assert len(results) == 2
