import re
from rest_framework import serializers
from .models import Supplier, Material, Scrap, ScrapSale, AuditLog


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


class ScrapSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(source="material.material_name", read_only=True)
    material_type = serializers.CharField(source="material.material_type", read_only=True)

    class Meta:
        model = Scrap
        fields = [
            "id",
            "material",
            "material_name",
            "material_type",
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
        read_only_fields = ["id", "sale_date", "sold_by", "total_amount", "profit"]

    def get_sold_by_name(self, obj):
        if not obj.sold_by:
            return ""
        try:
            return obj.sold_by.profile.full_name or obj.sold_by.email
        except Exception:
            return obj.sold_by.email

    def validate(self, attrs):
        scrap = attrs.get("scrap")
        quantity_sold = attrs.get("quantity_sold")

        if scrap.status == Scrap.ScrapStatus.SOLD:
            raise serializers.ValidationError(
                {"scrap": "This scrap record has already been fully sold."}
            )

        if quantity_sold <= 0:
            raise serializers.ValidationError(
                {"quantity_sold": "Weight to sell must be greater than zero."}
            )

        if quantity_sold > scrap.weight_kg:
            raise serializers.ValidationError(
                {
                    "quantity_sold": f"Cannot sell more than the available weight of {scrap.weight_kg:.3f} kg."
                }
            )

        return attrs

    def create(self, validated_data):
        from django.db import transaction

        scrap = validated_data["scrap"]
        weight = validated_data["quantity_sold"]
        price_per_kg = validated_data["sale_price_per_kg"]
        total_amount = weight * price_per_kg
        # Profit = revenue - cost of the leather that became scrap
        unit_cost = scrap.material.unit_cost or 0
        profit = total_amount - (unit_cost * weight)

        with transaction.atomic():
            # Lock the scrap record to prevent race conditions during concurrent requests
            scrap = Scrap.objects.select_for_update().get(pk=scrap.pk)

            # Re-verify weight under lock
            if weight > scrap.weight_kg:
                raise serializers.ValidationError(
                    {
                        "quantity_sold": f"Cannot sell more than the available weight of {scrap.weight_kg:.3f} kg."
                    }
                )

            # Deduct the weight and adjust status if sold out
            scrap.weight_kg -= weight
            if scrap.weight_kg <= 0:
                scrap.weight_kg = 0
                scrap.status = Scrap.ScrapStatus.SOLD
            scrap.save(update_fields=["weight_kg", "status"])

            return ScrapSale.objects.create(
                **validated_data,
                total_amount=total_amount,
                profit=profit,
            )




class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "user", "username", "action", "action_display", "details", "timestamp"]
        read_only_fields = ["id", "timestamp"]
