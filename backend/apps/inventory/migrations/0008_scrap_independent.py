from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0007_scrapsale_quantity_sold_decimal"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Drop the old material FK from Scrap (CASCADE — removes existing scrap records tied to materials)
        migrations.RemoveField(
            model_name="scrap",
            name="material",
        ),

        # 2. Add description field
        migrations.AddField(
            model_name="scrap",
            name="description",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Optional label for this scrap batch (e.g. 'Cowhide offcuts').",
                max_length=255,
            ),
        ),

        # 3. Add price_per_kg field
        migrations.AddField(
            model_name="scrap",
            name="price_per_kg",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Selling price per kilogram set when the batch was added.",
                max_digits=10,
            ),
        ),

        # 4. Add recorded_by FK
        migrations.AddField(
            model_name="scrap",
            name="recorded_by",
            field=models.ForeignKey(
                blank=True,
                help_text="The user who logged this scrap batch.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="scraps_recorded",
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # 5. Remove profit field from ScrapSale (no longer meaningful without material cost)
        migrations.RemoveField(
            model_name="scrapsale",
            name="profit",
        ),
    ]
