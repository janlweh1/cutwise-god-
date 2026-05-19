from rest_framework import viewsets, filters
from .models import Category, Product, StockMovement
from .serializers import CategorySerializer, ProductSerializer, StockMovementSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD operations for product categories."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    search_fields = ["name"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "created_at"]


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD operations for inventory products."""

    queryset = Product.objects.select_related("category").all()
    serializer_class = ProductSerializer
    search_fields = ["name", "sku", "description"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["name", "price", "quantity", "created_at"]


class StockMovementViewSet(viewsets.ModelViewSet):
    """CRUD operations for stock movements."""

    queryset = StockMovement.objects.select_related("product").all()
    serializer_class = StockMovementSerializer
    search_fields = ["product__name", "reference"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["created_at", "movement_type"]
