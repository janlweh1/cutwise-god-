from django.contrib import admin
from .models import Supplier, Material, Scrap, ScrapSale, AuditLog


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "contact_person", "phone", "email"]
    search_fields = ["name", "contact_person"]


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ["material_name", "material_type", "quantity", "unit_cost", "supplier", "last_update"]
    list_filter = ["material_type", "supplier"]
    search_fields = ["material_name"]


@admin.register(Scrap)
class ScrapAdmin(admin.ModelAdmin):
    list_display = ["material", "weight_kg", "status", "recorded_date"]
    list_filter = ["status"]
    search_fields = ["material__material_name"]


@admin.register(ScrapSale)
class ScrapSaleAdmin(admin.ModelAdmin):
    list_display = ["scrap", "quantity_sold", "sale_price_per_kg", "total_amount", "sale_date"]
    search_fields = ["scrap__material__material_name"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["username", "action", "details", "timestamp"]
    list_filter = ["action"]
    search_fields = ["username", "action"]
