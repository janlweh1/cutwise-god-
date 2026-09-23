from django.contrib import admin
from .models import Supplier, Material, ScrapType, ScrapSale, AuditLog


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "contact_person", "phone", "email"]
    search_fields = ["name", "contact_person"]


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ["material_name", "material_type", "quantity", "unit_cost", "supplier", "last_update"]
    list_filter = ["material_type", "supplier"]
    search_fields = ["material_name"]


@admin.register(ScrapType)
class ScrapTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "price_per_kg", "available_kg", "created_at"]
    search_fields = ["name"]
    ordering = ["price_per_kg"]


@admin.register(ScrapSale)
class ScrapSaleAdmin(admin.ModelAdmin):
    list_display = ["scrap_type", "quantity_sold", "sale_price_per_kg", "total_amount", "sold_by", "sale_date"]
    list_filter = ["scrap_type"]
    search_fields = ["scrap_type__name", "sold_by__email"]
    ordering = ["-sale_date"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["username", "action", "details", "timestamp"]
    list_filter = ["action"]
    search_fields = ["username", "action"]
