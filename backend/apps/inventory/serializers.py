import re
from rest_framework import serializers
from .models import Supplier, Material, ScrapType, ScrapSale, AuditLog


class SupplierSerializer(serializers.ModelSerializer):
    material_count = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "address", "material_count"]
        extra_kwargs = {
            "name": {"required": True, "allow_blank": False},
            "contact_person": {"required": True, "allow_blank": False},
            "phone": {"required": True, "allow_blank": False},
            "email": {"required": True, "allow_blank": False},
        }

    def get_material_count(self, obj):
        return obj.materials.count()

    def validate_phone(self, value):
        import phonenumbers
        from phonenumbers import NumberParseException

        value = " ".join(value.strip().split())

        try:
            parsed_number = phonenumbers.parse(value, None)
            if not phonenumbers.is_valid_number(parsed_number):
                raise serializers.ValidationError(
                    "Invalid international phone number structure or digit count."
                )

            formatted = phonenumbers.format_number(
                parsed_number, phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )
            return formatted
        except NumberParseException:
            raise serializers.ValidationError(
                "Phone number must start with a valid country code (e.g. +63) followed by the phone number."
            )


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


# ──────────────────────────────────────────────
# Scrap Type
# ──────────────────────────────────────────────

class ScrapTypeSerializer(serializers.ModelSerializer):
    """Serializer for production scrap categories."""

    class Meta:
        model = ScrapType
        fields = [
            "id",
            "name",
            "price_per_kg",
            "available_kg",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ──────────────────────────────────────────────
# Scrap Sale
# ──────────────────────────────────────────────

class ScrapSaleSerializer(serializers.ModelSerializer):
    scrap_type_name = serializers.CharField(source="scrap_type.name", read_only=True)
    price_per_kg_snapshot = serializers.DecimalField(
        source="scrap_type.price_per_kg", max_digits=10, decimal_places=2, read_only=True
    )
    sold_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ScrapSale
        fields = [
            "id",
            "scrap_type",
            "scrap_type_name",
            "price_per_kg_snapshot",
            "sold_by",
            "sold_by_name",
            "quantity_sold",
            "sale_price_per_kg",
            "total_amount",
            "sale_date",
        ]
        read_only_fields = ["id", "sale_date", "sold_by", "total_amount", "sale_price_per_kg"]

    def get_sold_by_name(self, obj):
        if not obj.sold_by:
            return ""
        try:
            return obj.sold_by.profile.full_name or obj.sold_by.email
        except Exception:
            return obj.sold_by.email

    def validate(self, attrs):
        scrap_type = attrs.get("scrap_type")
        quantity_sold = attrs.get("quantity_sold")

        if quantity_sold is None or quantity_sold <= 0:
            raise serializers.ValidationError(
                {"quantity_sold": "Weight to sell must be greater than zero."}
            )

        if quantity_sold > scrap_type.available_kg:
            raise serializers.ValidationError(
                {
                    "quantity_sold": (
                        f"Cannot sell more than the available stock of "
                        f"{scrap_type.available_kg:.3f} kg for '{scrap_type.name}'."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        from django.db import transaction

        scrap_type = validated_data["scrap_type"]
        quantity = validated_data["quantity_sold"]

        with transaction.atomic():
            # Lock the scrap type row to prevent race conditions
            scrap_type = ScrapType.objects.select_for_update().get(pk=scrap_type.pk)

            # Re-verify under lock
            if quantity > scrap_type.available_kg:
                raise serializers.ValidationError(
                    {
                        "quantity_sold": (
                            f"Cannot sell more than the available stock of "
                            f"{scrap_type.available_kg:.3f} kg for '{scrap_type.name}'."
                        )
                    }
                )

            price_per_kg = scrap_type.price_per_kg
            total_amount = quantity * price_per_kg

            # Deduct from available stock
            scrap_type.available_kg -= quantity
            scrap_type.save(update_fields=["available_kg"])

            return ScrapSale.objects.create(
                scrap_type=scrap_type,
                quantity_sold=quantity,
                sale_price_per_kg=price_per_kg,
                total_amount=total_amount,
                **{k: v for k, v in validated_data.items()
                   if k not in ("scrap_type", "quantity_sold")},
            )


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "user", "username", "action", "action_display", "details", "timestamp"]
        read_only_fields = ["id", "timestamp"]
