"""
Migration 0008: Scrap system overhaul
- Drops old Scrap and ScrapSale tables (Material-linked)
- Creates ScrapType table
- Creates new ScrapSale table (ScrapType-linked)
- Seeds two default ScrapType rows
- Updates AuditLog action choices (SCRAP_RECORDED → SCRAP_STOCK_ADDED)
"""

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def seed_scrap_types(apps, schema_editor):
    """Insert the two default production scrap types."""
    ScrapType = apps.get_model("inventory", "ScrapType")
    ScrapType.objects.create(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        name="Low-grade Scrap",
        price_per_kg="70.00",
        available_kg="10.000",
    )
    ScrapType.objects.create(
        id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
        name="High-grade Scrap",
        price_per_kg="180.00",
        available_kg="8.000",
    )


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0007_scrapsale_quantity_sold_decimal"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── 1. Drop old ScrapSale (references Scrap) ─────────────────────
        migrations.DeleteModel(name="ScrapSale"),

        # ── 2. Drop old Scrap (references Material) ──────────────────────
        migrations.DeleteModel(name="Scrap"),

        # ── 3. Create ScrapType ───────────────────────────────────────────
        migrations.CreateModel(
            name="ScrapType",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(
                    help_text="Display name for this scrap type (e.g. 'Low-grade Scrap').",
                    max_length=255,
                    unique=True,
                )),
                ("price_per_kg", models.DecimalField(
                    decimal_places=2,
                    default=0,
                    help_text="Selling price per kilogram in Philippine Pesos.",
                    max_digits=10,
                )),
                ("available_kg", models.DecimalField(
                    decimal_places=3,
                    default=0,
                    help_text="Current available stock in kilograms.",
                    max_digits=12,
                )),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["price_per_kg"]},
        ),

        # ── 4. Seed default scrap types ───────────────────────────────────
        migrations.RunPython(seed_scrap_types, migrations.RunPython.noop),

        # ── 5. Create new ScrapSale ───────────────────────────────────────
        migrations.CreateModel(
            name="ScrapSale",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("scrap_type", models.ForeignKey(
                    help_text="The type of scrap that was sold.",
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="sales",
                    to="inventory.scraptype",
                )),
                ("sold_by", models.ForeignKey(
                    blank=True,
                    help_text="The user who processed this sale.",
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="scrap_sales",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("quantity_sold", models.DecimalField(
                    decimal_places=3,
                    default=0,
                    help_text="Weight sold in kilograms.",
                    max_digits=10,
                )),
                ("sale_price_per_kg", models.DecimalField(
                    decimal_places=2,
                    default=0,
                    help_text="Price per kg at the time of sale.",
                    max_digits=12,
                )),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("sale_date", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-sale_date"]},
        ),

        # ── 6. Update AuditLog choices (no DB schema change needed, ────────
        #       Django choices are stored as strings; update display only)
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("material_added", "Material Added"),
                    ("material_updated", "Material Updated"),
                    ("material_deleted", "Material Deleted"),
                    ("scrap_stock_added", "Scrap Stock Added"),
                    ("scrap_sold", "Scrap Sold"),
                    ("stock_adjusted", "Stock Adjusted"),
                    ("supplier_added", "Supplier Added"),
                    ("supplier_updated", "Supplier Updated"),
                    ("supplier_deleted", "Supplier Deleted"),
                    ("config_updated", "Configuration Updated"),
                ],
                max_length=30,
            ),
        ),
    ]
