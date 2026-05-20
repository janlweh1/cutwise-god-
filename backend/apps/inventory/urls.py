from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "inventory"

router = DefaultRouter()

# Legacy routes
router.register(r"categories", views.CategoryViewSet, basename="category")
router.register(r"products", views.ProductViewSet, basename="product")
router.register(r"stock-movements", views.StockMovementViewSet, basename="stock-movement")

# Sprint 1 routes
router.register(r"suppliers", views.SupplierViewSet, basename="supplier")
router.register(r"materials", views.MaterialViewSet, basename="material")
router.register(r"scrap", views.ScrapInventoryViewSet, basename="scrap")
router.register(r"logs", views.AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("", include(router.urls)),
]
