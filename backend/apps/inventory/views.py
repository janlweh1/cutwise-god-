from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count, F, Q, DecimalField
from django.db.models.functions import Coalesce
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from apps.authentication.permissions import IsAdminOrSupervisorUserRole
from .models import Supplier, Material, ScrapType, ScrapSale, AuditLog
from .serializers import (
    SupplierSerializer,
    MaterialSerializer,
    ScrapTypeSerializer,
    ScrapSaleSerializer,
    AuditLogSerializer,
)


# ──────────────────────────────────────────────
class MaterialPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 200


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

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(
            self.request.user,
            AuditLog.ActionType.SUPPLIER_UPDATED,
            f"Updated supplier: {instance.name}",
        )

    def perform_destroy(self, instance):
        name = instance.name
        log_action(
            self.request.user,
            AuditLog.ActionType.SUPPLIER_DELETED,
            f"Deleted supplier: {name}",
        )
        instance.delete()


# ──────────────────────────────────────────────
# Material
# ──────────────────────────────────────────────

class MaterialViewSet(viewsets.ModelViewSet):
    """CRUD operations for raw materials."""

    # Allow unauthenticated access for cross-subsystem integration (Tailscale network)
    permission_classes = [AllowAny]
    pagination_class = MaterialPagination

    queryset = Material.objects.select_related("supplier", "added_by").all()
    serializer_class = MaterialSerializer
    search_fields = ["material_name", "material_type"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["material_name", "quantity", "unit_cost", "last_update"]

    def get_queryset(self):
        qs = super().get_queryset()
        stock_status = self.request.query_params.get("stock_status")
        if stock_status == "low_stock":
            qs = qs.filter(quantity__gt=0, quantity__lte=F("min_stock"))
        elif stock_status == "out_of_stock":
            qs = qs.filter(quantity=0)
        elif stock_status == "in_stock":
            qs = qs.filter(quantity__gt=F("min_stock"))

        # Server-side material type filter (fixes client-side pagination mismatch)
        material_type = self.request.query_params.get("material_type")
        if material_type:
            qs = qs.filter(material_type=material_type)

        # Date range filtering for report generation (based on last_update)
        date_from = self.request.query_params.get("date_from")
        date_to   = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(last_update__date__gte=date_from)
        if date_to:
            qs = qs.filter(last_update__date__lte=date_to)

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

    @action(detail=False, methods=["get"], url_path="summary", permission_classes=[AllowAny])
    def summary(self, request):
        """
        Returns DB-level aggregate stats for the dashboard home page.
        A single query replaces the need to paginate through all materials on the frontend.
        """
        from django.db.models import ExpressionWrapper

        qs = Material.objects.all()

        # Total number of distinct material records
        total_materials = qs.count()

        # quantity (IntegerField) × unit_cost (DecimalField) — must wrap with explicit output_field
        value_expr = ExpressionWrapper(
            F("quantity") * F("unit_cost"),
            output_field=DecimalField(max_digits=20, decimal_places=2),
        )

        # Aggregate totals via DB (fast regardless of record count)
        agg = qs.aggregate(
            total_units=Coalesce(Sum("quantity"), 0),
            total_value=Coalesce(Sum(value_expr), 0, output_field=DecimalField()),
            low_stock_count=Count(
                "id",
                filter=Q(quantity__gt=0, quantity__lte=F("min_stock")),
            ),
            out_of_stock_count=Count(
                "id",
                filter=Q(quantity=0),
            ),
        )

        # Per-type unit distribution for the bar chart
        type_distribution = (
            qs.values("material_type")
            .annotate(total_units=Sum("quantity"))
            .order_by("-total_units")
        )

        return Response(
            {
                "total_materials": total_materials,
                "total_units": agg["total_units"],
                "total_value": agg["total_value"],
                "low_stock_count": agg["low_stock_count"],
                "out_of_stock_count": agg["out_of_stock_count"],
                "in_stock_count": (
                    total_materials
                    - agg["low_stock_count"]
                    - agg["out_of_stock_count"]
                ),
                "type_distribution": list(type_distribution),
            }
        )

    @action(detail=True, methods=["post"], url_path="deduct", permission_classes=[AllowAny])
    def deduct(self, request, pk=None):
        """Deduct a quantity from a material's stock. Used for cross-system integration."""
        material = self.get_object()
        quantity_to_deduct = request.data.get("quantity")

        # --- Validation ---
        if quantity_to_deduct is None:
            return Response(
                {"error": "Quantity is required to deduct stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            quantity_to_deduct = int(quantity_to_deduct)
        except (ValueError, TypeError):
            return Response(
                {"error": "Quantity must be a valid whole number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity_to_deduct <= 0:
            return Response(
                {"error": "Quantity to deduct must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Atomic deduction with row-level lock ---
        with transaction.atomic():
            # select_for_update() locks the row until the transaction completes,
            # preventing race conditions from concurrent deduction requests.
            material = Material.objects.select_for_update().get(pk=material.pk)

            if material.quantity < quantity_to_deduct:
                return Response(
                    {
                        "error": f"Insufficient stock. Current stock: {material.quantity}",
                        "current_quantity": material.quantity,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            material.quantity -= quantity_to_deduct
            material.save(update_fields=["quantity"])

            log_action(
                request.user,
                AuditLog.ActionType.STOCK_ADJUSTED,
                f"Stock deducted: {material.material_name} — Deducted: {quantity_to_deduct} — Remaining: {material.quantity}",
            )

        return Response(
            {
                "status": "success",
                "message": f"Successfully deducted {quantity_to_deduct} from stock.",
                "material_id": material.pk,
                "material_name": material.material_name,
                "new_quantity": material.quantity,
            },
            status=status.HTTP_200_OK,
        )


# ──────────────────────────────────────────────
# Scrap Type
# ──────────────────────────────────────────────

class ScrapTypeViewSet(viewsets.ModelViewSet):
    """
    CRUD for production scrap types.
    Admins/supervisors can manage scrap types and top up available stock.
    """

    queryset = ScrapType.objects.all()
    serializer_class = ScrapTypeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["price_per_kg", "name", "available_kg"]

    @action(detail=True, methods=["post"], url_path="add_stock")
    def add_stock(self, request, pk=None):
        """
        Add kilograms to this scrap type's available stock.
        Payload: { "kg": <positive decimal> }
        """
        scrap_type = self.get_object()
        kg_raw = request.data.get("kg")

        if kg_raw is None:
            return Response(
                {"error": "Field 'kg' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from decimal import Decimal, InvalidOperation
            kg = Decimal(str(kg_raw))
        except (InvalidOperation, TypeError, ValueError):
            return Response(
                {"error": "Field 'kg' must be a valid decimal number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if kg <= 0:
            return Response(
                {"error": "Field 'kg' must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            scrap_type = ScrapType.objects.select_for_update().get(pk=scrap_type.pk)
            scrap_type.available_kg += kg
            scrap_type.save(update_fields=["available_kg"])

        log_action(
            request.user,
            AuditLog.ActionType.SCRAP_STOCK_ADDED,
            f"Added {kg} kg to '{scrap_type.name}' — New total: {scrap_type.available_kg} kg",
        )

        return Response(
            {
                "status": "success",
                "message": f"Added {kg} kg to '{scrap_type.name}'.",
                "scrap_type_id": str(scrap_type.pk),
                "name": scrap_type.name,
                "new_available_kg": str(scrap_type.available_kg),
            },
            status=status.HTTP_200_OK,
        )


# ──────────────────────────────────────────────
# Scrap Sale
# ──────────────────────────────────────────────

class ScrapSaleViewSet(viewsets.ModelViewSet):
    """CRUD operations for scrap sale transactions."""

    queryset = ScrapSale.objects.select_related("scrap_type", "sold_by").all()
    serializer_class = ScrapSaleSerializer
    search_fields = ["scrap_type__name"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["sale_date", "total_amount", "quantity_sold"]

    def get_queryset(self):
        qs = super().get_queryset()

        # Date-time range filtering for report generation
        date_from = self.request.query_params.get("date_from")
        date_to   = self.request.query_params.get("date_to")
        time_from = self.request.query_params.get("time_from")
        time_to   = self.request.query_params.get("time_to")

        if date_from:
            dt_from_str = f"{date_from}T{time_from or '00:00:00'}"
            try:
                from django.utils.dateparse import parse_datetime
                from django.utils import timezone as tz
                dt = parse_datetime(dt_from_str)
                if dt:
                    if tz.is_naive(dt):
                        dt = tz.make_aware(dt)
                    qs = qs.filter(sale_date__gte=dt)
            except Exception:
                qs = qs.filter(sale_date__date__gte=date_from)

        if date_to:
            dt_to_str = f"{date_to}T{time_to or '23:59:59'}"
            try:
                from django.utils.dateparse import parse_datetime
                from django.utils import timezone as tz
                dt = parse_datetime(dt_to_str)
                if dt:
                    if tz.is_naive(dt):
                        dt = tz.make_aware(dt)
                    qs = qs.filter(sale_date__lte=dt)
            except Exception:
                qs = qs.filter(sale_date__date__lte=date_to)

        return qs

    def perform_create(self, serializer):
        instance = serializer.save(sold_by=self.request.user)
        log_action(
            self.request.user,
            AuditLog.ActionType.SCRAP_SOLD,
            (
                f"Sold {instance.quantity_sold} kg of '{instance.scrap_type.name}' "
                f"@ ₱{instance.sale_price_per_kg}/kg — Total: ₱{instance.total_amount}"
            ),
        )


# ──────────────────────────────────────────────
# Audit Log (read-only)
# ──────────────────────────────────────────────


class AuditLogPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 100


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to audit trail logs."""

    serializer_class = AuditLogSerializer
    pagination_class = AuditLogPagination
    permission_classes = [IsAdminOrSupervisorUserRole]
    search_fields = ["username", "action", "details"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["timestamp"]

    def get_queryset(self):
        queryset = AuditLog.objects.all()

        # Filter by username (exact, case-insensitive)
        username = self.request.query_params.get("username")
        if username:
            queryset = queryset.filter(username__iexact=username)

        # Filter by action type (exact)
        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        # Filter by single date (exact match of date part YYYY-MM-DD)
        date_str = self.request.query_params.get("date")
        if date_str:
            try:
                queryset = queryset.filter(timestamp__date=date_str)
            except ValueError:
                pass

        # Date-time range filtering for report generation
        date_from = self.request.query_params.get("date_from")
        date_to   = self.request.query_params.get("date_to")
        time_from = self.request.query_params.get("time_from")
        time_to   = self.request.query_params.get("time_to")

        if date_from:
            dt_from_str = f"{date_from}T{time_from or '00:00:00'}"
            try:
                from django.utils.dateparse import parse_datetime
                from django.utils import timezone as tz
                dt = parse_datetime(dt_from_str)
                if dt:
                    if tz.is_naive(dt):
                        dt = tz.make_aware(dt)
                    queryset = queryset.filter(timestamp__gte=dt)
            except Exception:
                queryset = queryset.filter(timestamp__date__gte=date_from)

        if date_to:
            dt_to_str = f"{date_to}T{time_to or '23:59:59'}"
            try:
                from django.utils.dateparse import parse_datetime
                from django.utils import timezone as tz
                dt = parse_datetime(dt_to_str)
                if dt:
                    if tz.is_naive(dt):
                        dt = tz.make_aware(dt)
                    queryset = queryset.filter(timestamp__lte=dt)
            except Exception:
                queryset = queryset.filter(timestamp__date__lte=date_to)

        return queryset
