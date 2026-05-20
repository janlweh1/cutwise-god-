from django.db import models as db_models
from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from .models import (
    Category,
    Product,
    StockMovement,
    Supplier,
    Material,
    ScrapInventory,
    AuditLog,
)
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    StockMovementSerializer,
    SupplierSerializer,
    MaterialSerializer,
    ScrapInventorySerializer,
    AuditLogSerializer,
)


# ──────────────────────────────────────────────
# Audit helper
# ──────────────────────────────────────────────

def log_action(user, action, details=""):
    """Write an entry to the AuditLog table."""
    username = ""
    if user and user.is_authenticated:
        full_name = getattr(user, "supabase_full_name", "") or user.first_name
        username = full_name or user.email or str(user)
    AuditLog.objects.create(
        user=user if (user and user.is_authenticated) else None,
        username=username,
        action=action,
        details=details,
    )


# ──────────────────────────────────────────────
# Legacy ViewSets (kept for backward-compat)
# ──────────────────────────────────────────────

class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD operations for product categories."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    search_fields = ["name"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "created_at"]


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD operations for inventory products."""

    queryset = Product.objects.select_related("category").all()
    serializer_class = ProductSerializer
    search_fields = ["name", "sku", "description"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "price", "quantity", "created_at"]


class StockMovementViewSet(viewsets.ModelViewSet):
    """CRUD operations for stock movements."""

    queryset = StockMovement.objects.select_related("product").all()
    serializer_class = StockMovementSerializer
    search_fields = ["product__name", "reference"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["created_at", "movement_type"]


# ──────────────────────────────────────────────
# Sprint 1 — Supplier
# ──────────────────────────────────────────────

class SupplierViewSet(viewsets.ModelViewSet):
    """CRUD operations for suppliers."""

    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    search_fields = ["name", "contact_person"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "created_at"]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            self.request.user,
            AuditLog.ActionType.SUPPLIER_ADDED,
            f"Added supplier: {instance.name}",
        )


# ──────────────────────────────────────────────
# Sprint 1 — Material
# ──────────────────────────────────────────────

class MaterialViewSet(viewsets.ModelViewSet):
    """CRUD operations for raw materials."""

    queryset = Material.objects.select_related("supplier").all()
    serializer_class = MaterialSerializer
    search_fields = ["name", "material_type"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "quantity", "unit_cost", "created_at"]
    filterset_fields = ["material_type", "supplier"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Optional query-param filter for stock status
        stock_status = self.request.query_params.get("stock_status")
        if stock_status == "low_stock":
            qs = qs.filter(quantity__gt=0, quantity__lte=db_models.F("reorder_level"))
        elif stock_status == "out_of_stock":
            qs = qs.filter(quantity=0)
        elif stock_status == "in_stock":
            qs = qs.filter(quantity__gt=db_models.F("reorder_level"))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            self.request.user,
            AuditLog.ActionType.MATERIAL_ADDED,
            f"Added material: {instance.name} ({instance.get_material_type_display()}) — Qty: {instance.quantity}",
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(
            self.request.user,
            AuditLog.ActionType.MATERIAL_UPDATED,
            f"Updated material: {instance.name} ({instance.get_material_type_display()}) — Qty: {instance.quantity}",
        )

    def perform_destroy(self, instance):
        name = instance.name
        log_action(
            self.request.user,
            AuditLog.ActionType.MATERIAL_DELETED,
            f"Deleted material: {name}",
        )
        instance.delete()


# ──────────────────────────────────────────────
# Sprint 1 — Scrap Inventory
# ──────────────────────────────────────────────

class ScrapInventoryViewSet(viewsets.ModelViewSet):
    """CRUD operations for scrap inventory records."""

    queryset = ScrapInventory.objects.all()
    serializer_class = ScrapInventorySerializer
    search_fields = ["source_batch", "material_type"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["created_at", "weight_kg", "value"]

    def perform_create(self, serializer):
        instance = serializer.save()
        action = (
            AuditLog.ActionType.SCRAP_CONVERTED
            if instance.source == "conversion"
            else AuditLog.ActionType.SCRAP_RECORDED
        )
        log_action(
            self.request.user,
            action,
            f"Scrap {instance.get_material_type_display()} — {instance.weight_kg} kg, Value: ₱{instance.value}",
        )


# ──────────────────────────────────────────────
# Sprint 1 — Audit Log (read-only)
# ──────────────────────────────────────────────

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to audit trail logs."""

    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    search_fields = ["username", "action", "details"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["timestamp"]
