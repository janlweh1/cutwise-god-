import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.core.models import TimeStampedModel


# ──────────────────────────────────────────────
# Supplier
# ──────────────────────────────────────────────

class Supplier(TimeStampedModel):
    """Supplier reference for raw material sourcing."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    contact_person = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# ──────────────────────────────────────────────
# Category  (kept for backward-compat)
# ──────────────────────────────────────────────

class Category(TimeStampedModel):
    """Product category for organizing inventory items."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


# ──────────────────────────────────────────────
# Material  (primary inventory item)
# ──────────────────────────────────────────────

class Material(TimeStampedModel):
    """Raw material tracked in the inventory."""

    class MaterialType(models.TextChoices):
        COWHIDE = "cowhide", "Cowhide"
        GOATSKIN = "goatskin", "Goatskin"
        SHEEPSKIN = "sheepskin", "Sheepskin"
        SUEDE = "suede", "Suede"
        NAPPA = "nappa", "Nappa Leather"
        SYNTHETIC = "synthetic", "Synthetic Leather"
        RUBBER = "rubber", "Rubber"
        THREAD = "thread", "Thread"
        ADHESIVE = "adhesive", "Adhesive"
        ACCESSORY = "accessory", "Accessory"
        OTHER = "other", "Other"

    class StockStatus(models.TextChoices):
        IN_STOCK = "in_stock", "In Stock"
        LOW_STOCK = "low_stock", "Low Stock"
        OUT_OF_STOCK = "out_of_stock", "Out of Stock"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    material_type = models.CharField(
        max_length=20,
        choices=MaterialType.choices,
        default=MaterialType.OTHER,
    )
    size = models.CharField(
        max_length=100, blank=True, default="",
        help_text="e.g., 12 sqft, 500ml, 1 roll",
    )
    quantity = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="materials",
    )
    reorder_level = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "material_type", "supplier"],
                name="unique_material_per_supplier",
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.get_material_type_display()})"

    @property
    def stock_status(self):
        if self.quantity == 0:
            return self.StockStatus.OUT_OF_STOCK
        if self.quantity <= self.reorder_level:
            return self.StockStatus.LOW_STOCK
        return self.StockStatus.IN_STOCK

    @property
    def total_value(self):
        return self.quantity * self.unit_cost


# ──────────────────────────────────────────────
# Product  (kept for backward-compat)
# ──────────────────────────────────────────────

class Product(TimeStampedModel):
    """Inventory product / item."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, unique=True, verbose_name="SKU")
    description = models.TextField(blank=True, default="")
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def is_low_stock(self):
        return self.quantity <= self.reorder_level


# ──────────────────────────────────────────────
# StockMovement  (kept for backward-compat)
# ──────────────────────────────────────────────

class StockMovement(TimeStampedModel):
    """Tracks inventory stock movements (in/out)."""

    class MovementType(models.TextChoices):
        IN = "IN", "Stock In"
        OUT = "OUT", "Stock Out"
        ADJUSTMENT = "ADJ", "Adjustment"
        RETURN = "RET", "Return"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="movements"
    )
    movement_type = models.CharField(max_length=3, choices=MovementType.choices)
    quantity = models.IntegerField()
    reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.get_movement_type_display()} — {self.product.name} x{self.quantity}"


# ──────────────────────────────────────────────
# Scrap Inventory
# ──────────────────────────────────────────────

class ScrapInventory(TimeStampedModel):
    """Scrap leather recorded from the Sales & Cutting subsystem
    or converted manually by an Inventory Clerk."""

    class ScrapSource(models.TextChoices):
        CUTTING = "cutting", "Cutting Leftover"
        CONVERSION = "conversion", "Manual Conversion"
        INTEGRATION = "integration", "API Integration"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_batch = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Batch reference from the Sales & Cutting subsystem",
    )
    material_type = models.CharField(
        max_length=20,
        choices=Material.MaterialType.choices,
        default=Material.MaterialType.OTHER,
    )
    weight_kg = models.DecimalField(
        max_digits=10, decimal_places=3, default=0,
        help_text="Weight in kilograms",
    )
    value = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Computed monetary value of the scrap",
    )
    source = models.CharField(
        max_length=20,
        choices=ScrapSource.choices,
        default=ScrapSource.CONVERSION,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        verbose_name_plural = "scrap inventory"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Scrap {self.get_material_type_display()} — {self.weight_kg} kg"


# ──────────────────────────────────────────────
# Audit Log
# ──────────────────────────────────────────────

class AuditLog(models.Model):
    """Immutable record of every significant inventory action."""

    class ActionType(models.TextChoices):
        MATERIAL_ADDED = "material_added", "Material Added"
        MATERIAL_UPDATED = "material_updated", "Material Updated"
        MATERIAL_DELETED = "material_deleted", "Material Deleted"
        SCRAP_RECORDED = "scrap_recorded", "Scrap Recorded"
        SCRAP_CONVERTED = "scrap_converted", "Scrap Converted"
        STOCK_ADJUSTED = "stock_adjusted", "Stock Adjusted"
        SUPPLIER_ADDED = "supplier_added", "Supplier Added"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    username = models.CharField(max_length=255, blank=True, default="")
    action = models.CharField(max_length=30, choices=ActionType.choices)
    details = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.username} — {self.get_action_display()}"
