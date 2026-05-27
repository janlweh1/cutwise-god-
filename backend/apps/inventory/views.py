from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Supplier, Material, Scrap, ScrapSale, AuditLog, Delivery
from .serializers import (
    SupplierSerializer,
    MaterialSerializer,
    ScrapSerializer,
    ScrapSaleSerializer,
    AuditLogSerializer,
    DeliverySerializer,
)


# ──────────────────────────────────────────────
# Audit helper
# ──────────────────────────────────────────────

def log_action(user, action, details=""):
    """Write an entry to the AuditLog table."""
    username = ""
    if user and user.is_authenticated:
        try:
            username = user.profile.full_name or user.email or str(user)
        except Exception:
            username = user.email or str(user)
    AuditLog.objects.create(
        user=user if (user and user.is_authenticated) else None,
        username=username,
        action=action,
        details=details,
    )


# ──────────────────────────────────────────────
# Supplier
# ──────────────────────────────────────────────

class SupplierViewSet(viewsets.ModelViewSet):
    """CRUD operations for suppliers."""

    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    search_fields = ["name", "contact_person"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name"]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            self.request.user,
            AuditLog.ActionType.SUPPLIER_ADDED,
            f"Added supplier: {instance.name}",
        )


# ──────────────────────────────────────────────
# Material
# ──────────────────────────────────────────────

class MaterialViewSet(viewsets.ModelViewSet):
    """CRUD operations for raw materials."""

    queryset = Material.objects.select_related("supplier", "added_by").all()
    serializer_class = MaterialSerializer
    search_fields = ["material_name", "material_type"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["material_name", "quantity", "unit_cost", "last_update"]

    def get_queryset(self):
        qs = super().get_queryset()
        stock_status = self.request.query_params.get("stock_status")
        if stock_status == "low_stock":
            from django.db import models as db_models
            qs = qs.filter(quantity__gt=0, quantity__lte=db_models.F("min_stock"))
        elif stock_status == "out_of_stock":
            qs = qs.filter(quantity=0)
        elif stock_status == "in_stock":
            from django.db import models as db_models
            qs = qs.filter(quantity__gt=db_models.F("min_stock"))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(added_by=self.request.user)
        log_action(
            self.request.user,
            AuditLog.ActionType.MATERIAL_ADDED,
            f"Added material: {instance.material_name} ({instance.get_material_type_display()}) — Qty: {instance.quantity}",
        )

    def perform_update(self, serializer):
        instance = serializer.save(added_by=self.request.user)
        log_action(
            self.request.user,
            AuditLog.ActionType.MATERIAL_UPDATED,
            f"Updated material: {instance.material_name} ({instance.get_material_type_display()}) — Qty: {instance.quantity}",
        )

    def perform_destroy(self, instance):
        name = instance.material_name
        log_action(
            self.request.user,
            AuditLog.ActionType.MATERIAL_DELETED,
            f"Deleted material: {name}",
        )
        instance.delete()


# ──────────────────────────────────────────────
# Scrap
# ──────────────────────────────────────────────

class ScrapViewSet(viewsets.ModelViewSet):
    """CRUD operations for scrap inventory."""

    queryset = Scrap.objects.select_related("material").all()
    serializer_class = ScrapSerializer
    search_fields = ["material__material_name", "status"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["recorded_date", "weight_kg", "status"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            self.request.user,
            AuditLog.ActionType.SCRAP_RECORDED,
            f"Scrap recorded from {instance.material.material_name} — {instance.weight_kg} kg",
        )


# ──────────────────────────────────────────────
# Scrap Sale
# ──────────────────────────────────────────────

class ScrapSaleViewSet(viewsets.ModelViewSet):
    """CRUD operations for scrap sale transactions."""

    queryset = ScrapSale.objects.select_related("scrap__material", "sold_by").all()
    serializer_class = ScrapSaleSerializer
    search_fields = ["scrap__material__material_name"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["sale_date", "total_amount", "profit"]

    def perform_create(self, serializer):
        instance = serializer.save(sold_by=self.request.user)

        # Mark the scrap as sold
        scrap = instance.scrap
        scrap.status = Scrap.ScrapStatus.SOLD
        scrap.save(update_fields=["status"])

        log_action(
            self.request.user,
            AuditLog.ActionType.SCRAP_SOLD,
            f"Sold scrap from {scrap.material.material_name} — {instance.quantity_sold} kg @ ₱{instance.sale_price_per_kg}/kg — Total: ₱{instance.total_amount}",
        )


# ──────────────────────────────────────────────
# Audit Log (read-only)
# ──────────────────────────────────────────────

class DeliveryViewSet(viewsets.ModelViewSet):
    """CRUD operations for incoming deliveries."""

    queryset = Delivery.objects.select_related("supplier", "received_by").all()
    serializer_class = DeliverySerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["batch_number", "material_name"]
    ordering_fields = ["created_at", "received_at"]

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        delivery = self.get_object()
        if delivery.status == Delivery.DeliveryStatus.RECEIVED:
            return Response(
                {"detail": "This delivery has already been received."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update delivery status
        delivery.status = Delivery.DeliveryStatus.RECEIVED
        delivery.received_at = timezone.now()
        delivery.received_by = request.user
        delivery.save()

        # Increment/Create Raw Material stock in inventory
        material_type = Material.MaterialType.OTHER
        name_lower = delivery.material_name.lower()
        for choice_val, choice_lbl in Material.MaterialType.choices:
            if choice_val in name_lower or choice_lbl.lower() in name_lower:
                material_type = choice_val
                break

        material, created = Material.objects.get_or_create(
            material_name=delivery.material_name,
            supplier=delivery.supplier,
            material_type=material_type,
            defaults={
                "size": delivery.size,
                "quantity": delivery.quantity,
                "added_by": request.user,
            }
        )

        if not created:
            material.quantity += delivery.quantity
            if delivery.size and not material.size:
                material.size = delivery.size
            material.added_by = request.user
            material.save()

        # Log the action in AuditLog
        log_action(
            request.user,
            AuditLog.ActionType.DELIVERY_RECEIVED,
            f"Received delivery: {delivery.material_name} — Qty: {delivery.quantity} (Batch: {delivery.batch_number})",
        )

        # Also log a material updated / added action in AuditLog to sync with standard material audits
        action_type = AuditLog.ActionType.MATERIAL_ADDED if created else AuditLog.ActionType.MATERIAL_UPDATED
        details_str = f"Added material: {material.material_name} ({material.get_material_type_display()}) — Qty: {material.quantity} (via delivery receipt)" if created else f"Updated material: {material.material_name} ({material.get_material_type_display()}) — Qty: {material.quantity} (via delivery receipt)"
        log_action(
            request.user,
            action_type,
            details_str,
        )

        serializer = self.get_serializer(delivery)
        return Response(serializer.data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to audit trail logs."""

    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    search_fields = ["username", "action", "details"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["timestamp"]
