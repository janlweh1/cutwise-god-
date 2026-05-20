from rest_framework import serializers
from .models import (
    Category,
    Product,
    StockMovement,
    Supplier,
    Material,
    ScrapInventory,
    AuditLog,
)


# ──────────────────────────────────────────────
# Legacy serializers (kept for backward-compat)
# ──────────────────────────────────────────────

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = "__all__"


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = "__all__"


# ──────────────────────────────────────────────
# Sprint 1 — New serializers
# ──────────────────────────────────────────────

class SupplierSerializer(serializers.ModelSerializer):
    material_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_person",
            "phone",
            "email",
            "address",
            "is_active",
            "material_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_material_count(self, obj):
        return obj.materials.count()


class MaterialSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    stock_status = serializers.CharField(read_only=True)
    total_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Material
        fields = [
            "id",
            "name",
            "material_type",
            "size",
            "quantity",
            "unit_cost",
            "supplier",
            "supplier_name",
            "reorder_level",
            "is_active",
            "stock_status",
            "total_value",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        """Reject duplicate material records (same name + type + supplier)."""
        name = data.get("name", getattr(self.instance, "name", None))
        material_type = data.get(
            "material_type", getattr(self.instance, "material_type", None)
        )
        supplier = data.get("supplier", getattr(self.instance, "supplier", None))

        qs = Material.objects.filter(
            name__iexact=name,
            material_type=material_type,
            supplier=supplier,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A material with this name, type, and supplier already exists."
            )
        return data


class ScrapInventorySerializer(serializers.ModelSerializer):
    material_type_display = serializers.CharField(
        source="get_material_type_display", read_only=True
    )
    source_display = serializers.CharField(
        source="get_source_display", read_only=True
    )

    class Meta:
        model = ScrapInventory
        fields = [
            "id",
            "source_batch",
            "material_type",
            "material_type_display",
            "weight_kg",
            "value",
            "source",
            "source_display",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "value", "created_at", "updated_at"]

    # Default scrap pricing per kg (₱ per kg) by material type
    SCRAP_RATES = {
        "cowhide": 50,
        "goatskin": 45,
        "sheepskin": 40,
        "suede": 35,
        "nappa": 55,
        "synthetic": 20,
        "rubber": 15,
        "other": 25,
    }

    def create(self, validated_data):
        """Auto-compute scrap value based on weight and material type."""
        material_type = validated_data.get("material_type", "other")
        weight = validated_data.get("weight_kg", 0)
        rate = self.SCRAP_RATES.get(material_type, 25)
        validated_data["value"] = round(float(weight) * rate, 2)
        return super().create(validated_data)


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(
        source="get_action_display", read_only=True
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "username",
            "action",
            "action_display",
            "details",
            "timestamp",
        ]
        read_only_fields = fields
