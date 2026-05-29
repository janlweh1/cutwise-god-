from rest_framework import serializers
from .models import Supplier, Material, Scrap, ScrapSale, AuditLog


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "address"]


class MaterialSerializer(serializers.ModelSerializer):
    stock_status = serializers.ReadOnlyField()
    total_value = serializers.ReadOnlyField()
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    added_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "added_by",
            "added_by_name",
            "material_name",
            "material_type",
            "size",
            "quantity",
            "unit_cost",
            "min_stock",
            "last_update",
            "stock_status",
            "total_value",
        ]
        read_only_fields = ["id", "last_update", "added_by"]

    def get_added_by_name(self, obj):
        if not obj.added_by:
            return ""
        try:
            return obj.added_by.profile.full_name or obj.added_by.email
        except Exception:
            return obj.added_by.email


class ScrapSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.material_name", read_only=True)

    class Meta:
        model = Scrap
        fields = [
            "id",
            "material",
            "material_name",
            "weight_kg",
            "recorded_date",
            "status",
        ]
        read_only_fields = ["id", "recorded_date"]


class ScrapSaleSerializer(serializers.ModelSerializer):
    scrap_material = serializers.CharField(
        source="scrap.material.material_name", read_only=True
    )
    sold_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ScrapSale
        fields = [
            "id",
            "scrap",
            "scrap_material",
            "sold_by",
            "sold_by_name",
            "quantity_sold",
            "sale_price_per_kg",
            "total_amount",
            "sale_date",
            "profit",
        ]
        read_only_fields = ["id", "sale_date", "sold_by"]

    def get_sold_by_name(self, obj):
        if not obj.sold_by:
            return ""
        try:
            return obj.sold_by.profile.full_name or obj.sold_by.email
        except Exception:
            return obj.sold_by.email




class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "user", "username", "action", "action_display", "details", "timestamp"]
        read_only_fields = ["id", "timestamp"]
