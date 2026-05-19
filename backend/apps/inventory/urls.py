from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "inventory"

router = DefaultRouter()
router.register(r"categories", views.CategoryViewSet, basename="category")
router.register(r"products", views.ProductViewSet, basename="product")
router.register(r"stock-movements", views.StockMovementViewSet, basename="stock-movement")

urlpatterns = [
    path("", include(router.urls)),
]
