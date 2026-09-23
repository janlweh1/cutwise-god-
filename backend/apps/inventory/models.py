import uuid
from django.db import models
from django.contrib.auth.models import User


# ──────────────────────────────────────────────
# Supplier
# ──────────────────────────────────────────────

class Supplier(models.Model):
    """Supplier reference for raw material sourcing."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    contact_person = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# ──────────────────────────────────────────────
# Material
# ──────────────────────────────────────────────

class Material(models.Model):
    """Raw material tracked in the inventory."""

    # Preset type slugs — used for frontend dropdown mapping
    PRESET_TYPES = [
        "cowhide", "goatskin", "sheepskin", "suede", "nappa",
        "synthetic", "other",
    ]

    class MaterialType:
        COWHIDE = "cowhide"
        GOATSKIN = "goatskin"
        SHEEPSKIN = "sheepskin"
        SUEDE = "suede"
        NAPPA = "nappa"
        SYNTHETIC = "synthetic"
        OTHER = "other"

    class StockStatus(models.TextChoices):
        IN_STOCK = "in_stock", "In Stock"
        LOW_STOCK = "low_stock", "Low Stock"
        OUT_OF_STOCK = "out_of_stock", "Out of Stock"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="materials",
    )
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="materials_added",
        help_text="The user who added or last updated this material.",
    )
    material_name = models.CharField(max_length=255)
    material_type = models.CharField(
        max_length=100,
        default="other",
        help_text="Material type. Use a preset value or a custom label.",
    )
    size = models.CharField(
        max_length=100, blank=True, default="",
        help_text="e.g., 12 sqft, 500ml, 1 roll",
    )
    quantity = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    min_stock = models.PositiveIntegerField(
        default=10,
        help_text="Minimum stock level before a low-stock alert is raised.",
    )
    last_update = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["material_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["material_name", "material_type", "supplier"],
                name="unique_material_per_supplier",
            )
        ]

    def get_material_type_display(self):
        mapping = {
            "cowhide": "Cowhide",
            "goatskin": "Goatskin",
            "sheepskin": "Sheepskin",
            "suede": "Suede",
            "nappa": "Nappa Leather",
            "synthetic": "Synthetic Leather",
            "other": "Other",
        }
        return mapping.get(self.material_type, self.material_type.title())

    def __str__(self):
        return f"{self.material_name} ({self.get_material_type_display()})"

    @property
    def stock_status(self):
        if self.quantity == 0:
            return self.StockStatus.OUT_OF_STOCK
        if self.quantity <= self.min_stock:
            return self.StockStatus.LOW_STOCK
        return self.StockStatus.IN_STOCK

    @property
    def total_value(self):
        return self.quantity * self.unit_cost


# ──────────────────────────────────────────────
# Scrap Type
# ──────────────────────────────────────────────

class ScrapType(models.Model):
    """
    Defines a category of production scrap (e.g. Low-grade or High-grade).
    Tracks the total available kilograms currently on hand from production.
    Not linked to inventory materials — scraps come directly from the
    cutting/production process.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=255,
        unique=True,
        help_text="Display name for this scrap type (e.g. 'Low-grade Scrap').",
    )
    price_per_kg = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Selling price per kilogram in Philippine Pesos.",
    )
    available_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
        help_text="Current available stock in kilograms (updated on stock additions and sales).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["price_per_kg"]

    def __str__(self):
        return f"{self.name} (₱{self.price_per_kg}/kg)"


# ──────────────────────────────────────────────
# Scrap Sale
# ──────────────────────────────────────────────

class ScrapSale(models.Model):
    """
    Records a sale transaction for production scrap.
    Directly references the ScrapType, which tracks available_kg.
    Revenue = quantity_sold × price_per_kg (no material cost deducted).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scrap_type = models.ForeignKey(
        ScrapType,
        on_delete=models.PROTECT,
        related_name="sales",
        help_text="The type of scrap that was sold.",
    )
    sold_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scrap_sales",
        help_text="The user who processed this sale.",
    )
    quantity_sold = models.DecimalField(
        max_digits=10, decimal_places=3, default=0,
        help_text="Weight sold in kilograms.",
    )
    sale_price_per_kg = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Price per kg at the time of sale (snapshot of ScrapType.price_per_kg).",
    )
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sale_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sale_date"]

    def __str__(self):
        return f"Sale of {self.scrap_type.name} — {self.quantity_sold} kg @ ₱{self.sale_price_per_kg}/kg — ₱{self.total_amount}"


# ──────────────────────────────────────────────
# Audit Log
# ──────────────────────────────────────────────

class AuditLog(models.Model):
    """Immutable record of every significant inventory action."""

    class ActionType(models.TextChoices):
        MATERIAL_ADDED = "material_added", "Material Added"
        MATERIAL_UPDATED = "material_updated", "Material Updated"
        MATERIAL_DELETED = "material_deleted", "Material Deleted"
        SCRAP_STOCK_ADDED = "scrap_stock_added", "Scrap Stock Added"
        SCRAP_SOLD = "scrap_sold", "Scrap Sold"
        STOCK_ADJUSTED = "stock_adjusted", "Stock Adjusted"
        SUPPLIER_ADDED = "supplier_added", "Supplier Added"
        SUPPLIER_UPDATED = "supplier_updated", "Supplier Updated"
        SUPPLIER_DELETED = "supplier_deleted", "Supplier Deleted"
        CONFIG_UPDATED = "config_updated", "Configuration Updated"

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
