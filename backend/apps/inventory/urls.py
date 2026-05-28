from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "inventory"

router = DefaultRouter()
router.register(r"suppliers", views.SupplierViewSet, basename="supplier")
router.register(r"materials", views.MaterialViewSet, basename="material")
router.register(r"scrap", views.ScrapViewSet, basename="scrap")
router.register(r"scrap-sales", views.ScrapSaleViewSet, basename="scrap-sale")
router.register(r"logs", views.AuditLogViewSet, basename="audit-log")

urlpatterns = [
    path("", include(router.urls)),
]
