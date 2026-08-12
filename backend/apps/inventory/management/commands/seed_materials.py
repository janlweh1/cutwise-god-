"""
================================================================
  CutWise IMS — Seed Leather Materials
  Management Command: python manage.py seed_materials

  Seeds the inventory with realistic leather materials
  for Otto Shoes' CutWise IMS (Philippine shoe manufacturer).

  Safe to run multiple times — uses get_or_create so it won't
  duplicate existing records.
================================================================
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.inventory.models import Supplier, Material, AuditLog


# ─── Supplier seed data ───────────────────────────────────────────────────────

SUPPLIERS = [
    {
        "name": "Manila Leather Supply",
        "contact_person": "Ricardo Santos",
        "phone": "+63-2-8888-1234",
        "email": "sales@manilaleather.ph",
        "address": "1234 Bulacan Industrial Road, Meycauayan, Bulacan, Philippines",
    },
    {
        "name": "Cebu Hide & Tannery Co.",
        "contact_person": "Maria Reyes",
        "phone": "+63-32-412-5678",
        "email": "orders@cebuhide.ph",
        "address": "78 M. Velez St., Cebu City, Philippines",
    },
    {
        "name": "LuzonSkin Traders",
        "contact_person": "Jose dela Cruz",
        "phone": "+63-49-531-9900",
        "email": "info@luzonskin.ph",
        "address": "Km 47 National Highway, Calamba, Laguna, Philippines",
    },
    {
        "name": "Beta Supplier",
        "contact_person": "Ana Gomez",
        "phone": "+63-2-8777-5566",
        "email": "contact@betasupplier.ph",
        "address": "22 Shaw Blvd., Mandaluyong, Metro Manila, Philippines",
    },
]


# ─── Material seed data ───────────────────────────────────────────────────────
# Fields: material_name, material_type, size, quantity, unit_cost, min_stock, supplier_name

MATERIALS = [
    # ── Cowhide ──────────────────────────────────────────────────────────────
    {
        "material_name": "Full-Grain Cowhide Black",
        "material_type": "cowhide",
        "size": "12 sqft per hide",
        "quantity": 120,
        "unit_cost": 1850.00,
        "min_stock": 30,
        "supplier": "Manila Leather Supply",
    },
    {
        "material_name": "Full-Grain Cowhide Brown",
        "material_type": "cowhide",
        "size": "12 sqft per hide",
        "quantity": 85,
        "unit_cost": 1800.00,
        "min_stock": 25,
        "supplier": "Manila Leather Supply",
    },
    {
        "material_name": "Split Cowhide Tan",
        "material_type": "cowhide",
        "size": "10 sqft per hide",
        "quantity": 60,
        "unit_cost": 950.00,
        "min_stock": 20,
        "supplier": "Cebu Hide & Tannery Co.",
    },
    {
        "material_name": "Corrected-Grain Cowhide Navy",
        "material_type": "cowhide",
        "size": "11 sqft per hide",
        "quantity": 18,
        "unit_cost": 1200.00,
        "min_stock": 20,
        "supplier": "Manila Leather Supply",
    },

    # ── Goatskin ─────────────────────────────────────────────────────────────
    {
        "material_name": "Goatskin Brown Matte",
        "material_type": "goatskin",
        "size": "6 sqft per hide",
        "quantity": 95,
        "unit_cost": 780.00,
        "min_stock": 25,
        "supplier": "Cebu Hide & Tannery Co.",
    },
    {
        "material_name": "Goatskin Black Gloss",
        "material_type": "goatskin",
        "size": "6 sqft per hide",
        "quantity": 42,
        "unit_cost": 820.00,
        "min_stock": 20,
        "supplier": "LuzonSkin Traders",
    },
    {
        "material_name": "Goatskin Ivory Soft",
        "material_type": "goatskin",
        "size": "5 sqft per hide",
        "quantity": 12,
        "unit_cost": 910.00,
        "min_stock": 15,
        "supplier": "Cebu Hide & Tannery Co.",
    },

    # ── Sheepskin ─────────────────────────────────────────────────────────────
    {
        "material_name": "Raw Sheepskin Natural",
        "material_type": "sheepskin",
        "size": "8 sqft per hide",
        "quantity": 75,
        "unit_cost": 650.00,
        "min_stock": 20,
        "supplier": "LuzonSkin Traders",
    },
    {
        "material_name": "Sheepskin Caramel Suede-Back",
        "material_type": "sheepskin",
        "size": "7 sqft per hide",
        "quantity": 38,
        "unit_cost": 720.00,
        "min_stock": 15,
        "supplier": "Manila Leather Supply",
    },
    {
        "material_name": "Lambskin Ivory Ultra-Soft",
        "material_type": "sheepskin",
        "size": "5 sqft per hide",
        "quantity": 22,
        "unit_cost": 1450.00,
        "min_stock": 10,
        "supplier": "LuzonSkin Traders",
    },

    # ── Suede ─────────────────────────────────────────────────────────────────
    {
        "material_name": "Suede Charcoal",
        "material_type": "suede",
        "size": "9 sqft per hide",
        "quantity": 55,
        "unit_cost": 1100.00,
        "min_stock": 20,
        "supplier": "Manila Leather Supply",
    },
    {
        "material_name": "Suede Chestnut Brown",
        "material_type": "suede",
        "size": "9 sqft per hide",
        "quantity": 33,
        "unit_cost": 1050.00,
        "min_stock": 15,
        "supplier": "Beta Supplier",
    },
    {
        "material_name": "Suede Forest Green",
        "material_type": "suede",
        "size": "8 sqft per hide",
        "quantity": 8,
        "unit_cost": 1150.00,
        "min_stock": 12,
        "supplier": "Beta Supplier",
    },

    # ── Nappa ─────────────────────────────────────────────────────────────────
    {
        "material_name": "Nappa Black Premium",
        "material_type": "nappa",
        "size": "10 sqft per hide",
        "quantity": 65,
        "unit_cost": 2200.00,
        "min_stock": 20,
        "supplier": "Manila Leather Supply",
    },
    {
        "material_name": "Nappa White Dress",
        "material_type": "nappa",
        "size": "10 sqft per hide",
        "quantity": 28,
        "unit_cost": 2350.00,
        "min_stock": 15,
        "supplier": "Cebu Hide & Tannery Co.",
    },
    {
        "material_name": "Nappa Burgundy Soft",
        "material_type": "nappa",
        "size": "9 sqft per hide",
        "quantity": 14,
        "unit_cost": 2150.00,
        "min_stock": 12,
        "supplier": "Manila Leather Supply",
    },

    # ── Synthetic ─────────────────────────────────────────────────────────────
    {
        "material_name": "PU Synthetic Black",
        "material_type": "synthetic",
        "size": "1 roll (50m)",
        "quantity": 8,
        "unit_cost": 3800.00,
        "min_stock": 3,
        "supplier": "Beta Supplier",
    },
    {
        "material_name": "PU Synthetic Brown",
        "material_type": "synthetic",
        "size": "1 roll (50m)",
        "quantity": 5,
        "unit_cost": 3600.00,
        "min_stock": 3,
        "supplier": "Beta Supplier",
    },
    {
        "material_name": "Microfiber Synthetic White",
        "material_type": "synthetic",
        "size": "1 roll (40m)",
        "quantity": 3,
        "unit_cost": 4200.00,
        "min_stock": 2,
        "supplier": "LuzonSkin Traders",
    },

    # ── Other ─────────────────────────────────────────────────────────────────
    {
        "material_name": "Patent Leather Black High-Gloss",
        "material_type": "other",
        "size": "10 sqft per hide",
        "quantity": 40,
        "unit_cost": 1750.00,
        "min_stock": 15,
        "supplier": "Cebu Hide & Tannery Co.",
    },
    {
        "material_name": "Embossed Crocodile-Print Black",
        "material_type": "other",
        "size": "8 sqft per hide",
        "quantity": 25,
        "unit_cost": 2500.00,
        "min_stock": 10,
        "supplier": "Manila Leather Supply",
    },
    {
        "material_name": "Metallic Gold Leather",
        "material_type": "other",
        "size": "6 sqft per hide",
        "quantity": 10,
        "unit_cost": 3100.00,
        "min_stock": 5,
        "supplier": "Beta Supplier",
    },

    # ═══════════════════════════════════════════════════════════════════════════
    # BATCH 2 — 100 additional materials
    # ═══════════════════════════════════════════════════════════════════════════

    # ── Cowhide (20) ──────────────────────────────────────────────────────────
    {"material_name": "Vegetable-Tanned Cowhide Natural",    "material_type": "cowhide",   "size": "13 sqft per hide", "quantity": 90,  "unit_cost": 2100.00, "min_stock": 25, "supplier": "Manila Leather Supply"},
    {"material_name": "Drum-Dyed Cowhide Burgundy",          "material_type": "cowhide",   "size": "12 sqft per hide", "quantity": 55,  "unit_cost": 1950.00, "min_stock": 20, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Oil-Tanned Cowhide Havana",           "material_type": "cowhide",   "size": "12 sqft per hide", "quantity": 48,  "unit_cost": 2050.00, "min_stock": 20, "supplier": "Manila Leather Supply"},
    {"material_name": "Pull-Up Cowhide Cognac",              "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 36,  "unit_cost": 2200.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Crazy Horse Cowhide Brown",           "material_type": "cowhide",   "size": "12 sqft per hide", "quantity": 29,  "unit_cost": 2300.00, "min_stock": 15, "supplier": "Manila Leather Supply"},
    {"material_name": "Wax Pull-Up Cowhide Tan",             "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 42,  "unit_cost": 1980.00, "min_stock": 18, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Antique Finish Cowhide Dark Brown",   "material_type": "cowhide",   "size": "12 sqft per hide", "quantity": 22,  "unit_cost": 2150.00, "min_stock": 12, "supplier": "LuzonSkin Traders"},
    {"material_name": "Milled Cowhide Black",                "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 67,  "unit_cost": 1750.00, "min_stock": 25, "supplier": "Manila Leather Supply"},
    {"material_name": "Tumbled Cowhide Caramel",             "material_type": "cowhide",   "size": "10 sqft per hide", "quantity": 38,  "unit_cost": 1820.00, "min_stock": 15, "supplier": "Beta Supplier"},
    {"material_name": "Cowhide Russet Orange",               "material_type": "cowhide",   "size": "12 sqft per hide", "quantity": 15,  "unit_cost": 1900.00, "min_stock": 12, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Cowhide Midnight Blue",               "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 20,  "unit_cost": 1870.00, "min_stock": 12, "supplier": "Manila Leather Supply"},
    {"material_name": "Cowhide Olive Green",                 "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 31,  "unit_cost": 1850.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Cowhide Oxblood Red",                 "material_type": "cowhide",   "size": "12 sqft per hide", "quantity": 44,  "unit_cost": 1920.00, "min_stock": 18, "supplier": "Manila Leather Supply"},
    {"material_name": "Perforated Cowhide Black",            "material_type": "cowhide",   "size": "10 sqft per hide", "quantity": 19,  "unit_cost": 2000.00, "min_stock": 10, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Brushed Cowhide Graphite Grey",       "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 27,  "unit_cost": 1780.00, "min_stock": 12, "supplier": "Beta Supplier"},
    {"material_name": "Washed Cowhide Off-White",            "material_type": "cowhide",   "size": "10 sqft per hide", "quantity": 13,  "unit_cost": 1960.00, "min_stock": 10, "supplier": "LuzonSkin Traders"},
    {"material_name": "Metallic Silver Cowhide",             "material_type": "cowhide",   "size": "9 sqft per hide",  "quantity": 8,   "unit_cost": 2850.00, "min_stock": 6,  "supplier": "Beta Supplier"},
    {"material_name": "Two-Tone Cowhide Black and Brown",    "material_type": "cowhide",   "size": "11 sqft per hide", "quantity": 16,  "unit_cost": 2250.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Heavy-Weight Cowhide Natural",        "material_type": "cowhide",   "size": "14 sqft per hide", "quantity": 52,  "unit_cost": 1650.00, "min_stock": 20, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Embossed Python-Print Cowhide",       "material_type": "cowhide",   "size": "9 sqft per hide",  "quantity": 11,  "unit_cost": 2700.00, "min_stock": 8,  "supplier": "Manila Leather Supply"},

    # ── Goatskin (15) ─────────────────────────────────────────────────────────
    {"material_name": "Goatskin Tan Pebbled",                "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 58,  "unit_cost": 800.00,  "min_stock": 20, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Goatskin Red Burnished",              "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 34,  "unit_cost": 860.00,  "min_stock": 15, "supplier": "Manila Leather Supply"},
    {"material_name": "Goatskin Cobalt Blue",                "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 22,  "unit_cost": 890.00,  "min_stock": 12, "supplier": "LuzonSkin Traders"},
    {"material_name": "Goatskin Champagne",                  "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 17,  "unit_cost": 920.00,  "min_stock": 10, "supplier": "Beta Supplier"},
    {"material_name": "Goatskin Taupe",                      "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 41,  "unit_cost": 790.00,  "min_stock": 18, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Goatskin Forest Green",               "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 9,   "unit_cost": 850.00,  "min_stock": 10, "supplier": "LuzonSkin Traders"},
    {"material_name": "Goatskin Rust Brown",                 "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 26,  "unit_cost": 810.00,  "min_stock": 12, "supplier": "Manila Leather Supply"},
    {"material_name": "Goatskin Cream Washed",               "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 13,  "unit_cost": 870.00,  "min_stock": 10, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Goatskin Smoke Grey",                 "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 30,  "unit_cost": 825.00,  "min_stock": 15, "supplier": "Beta Supplier"},
    {"material_name": "Goatskin Vintage Brown",              "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 47,  "unit_cost": 840.00,  "min_stock": 18, "supplier": "Manila Leather Supply"},
    {"material_name": "Printed Goatskin Leopard",            "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 7,   "unit_cost": 1050.00, "min_stock": 6,  "supplier": "Beta Supplier"},
    {"material_name": "Goatskin Metallic Bronze",            "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 12,  "unit_cost": 1100.00, "min_stock": 8,  "supplier": "LuzonSkin Traders"},
    {"material_name": "Goatskin Coral Pink",                 "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 18,  "unit_cost": 900.00,  "min_stock": 10, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Goatskin Military Khaki",             "material_type": "goatskin",  "size": "6 sqft per hide",  "quantity": 23,  "unit_cost": 780.00,  "min_stock": 12, "supplier": "Manila Leather Supply"},
    {"material_name": "Goatskin Rose Gold Metallic",         "material_type": "goatskin",  "size": "5 sqft per hide",  "quantity": 10,  "unit_cost": 1150.00, "min_stock": 6,  "supplier": "Beta Supplier"},

    # ── Sheepskin (10) ────────────────────────────────────────────────────────
    {"material_name": "Shearling Sheepskin Double-Face",     "material_type": "sheepskin", "size": "8 sqft per hide",  "quantity": 35,  "unit_cost": 1900.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Sheepskin Cream Shearling",           "material_type": "sheepskin", "size": "8 sqft per hide",  "quantity": 20,  "unit_cost": 1800.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Sheepskin Brown Shearling",           "material_type": "sheepskin", "size": "7 sqft per hide",  "quantity": 28,  "unit_cost": 1750.00, "min_stock": 12, "supplier": "LuzonSkin Traders"},
    {"material_name": "Sheepskin Black Shearling",           "material_type": "sheepskin", "size": "7 sqft per hide",  "quantity": 24,  "unit_cost": 1850.00, "min_stock": 12, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Merino Sheepskin Silver Grey",        "material_type": "sheepskin", "size": "6 sqft per hide",  "quantity": 16,  "unit_cost": 2100.00, "min_stock": 8,  "supplier": "Manila Leather Supply"},
    {"material_name": "Sheepskin Taupe Suede-Back",          "material_type": "sheepskin", "size": "7 sqft per hide",  "quantity": 31,  "unit_cost": 750.00,  "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Sheepskin Tan Oil-Tanned",            "material_type": "sheepskin", "size": "8 sqft per hide",  "quantity": 43,  "unit_cost": 680.00,  "min_stock": 18, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Sheepskin Beige Perforated",          "material_type": "sheepskin", "size": "6 sqft per hide",  "quantity": 19,  "unit_cost": 770.00,  "min_stock": 10, "supplier": "Beta Supplier"},
    {"material_name": "Sheepskin Rust Vintage",              "material_type": "sheepskin", "size": "7 sqft per hide",  "quantity": 11,  "unit_cost": 730.00,  "min_stock": 8,  "supplier": "Manila Leather Supply"},
    {"material_name": "Sheepskin Navy Dyed",                 "material_type": "sheepskin", "size": "7 sqft per hide",  "quantity": 25,  "unit_cost": 700.00,  "min_stock": 12, "supplier": "LuzonSkin Traders"},

    # ── Suede (15) ────────────────────────────────────────────────────────────
    {"material_name": "Suede Dusty Rose",                    "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 40,  "unit_cost": 1080.00, "min_stock": 15, "supplier": "Manila Leather Supply"},
    {"material_name": "Suede Sky Blue",                      "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 29,  "unit_cost": 1060.00, "min_stock": 12, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Suede Burnt Orange",                  "material_type": "suede",     "size": "9 sqft per hide",  "quantity": 22,  "unit_cost": 1090.00, "min_stock": 12, "supplier": "Beta Supplier"},
    {"material_name": "Suede Cobalt Blue",                   "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 18,  "unit_cost": 1120.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Suede Mint Green",                    "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 14,  "unit_cost": 1050.00, "min_stock": 10, "supplier": "LuzonSkin Traders"},
    {"material_name": "Suede Mustard Yellow",                "material_type": "suede",     "size": "9 sqft per hide",  "quantity": 27,  "unit_cost": 1070.00, "min_stock": 12, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Suede Plum Purple",                   "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 20,  "unit_cost": 1100.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Suede Terracotta",                    "material_type": "suede",     "size": "9 sqft per hide",  "quantity": 35,  "unit_cost": 1040.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Suede Sand Beige",                    "material_type": "suede",     "size": "9 sqft per hide",  "quantity": 48,  "unit_cost": 1000.00, "min_stock": 18, "supplier": "Manila Leather Supply"},
    {"material_name": "Suede Dark Navy",                     "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 33,  "unit_cost": 1060.00, "min_stock": 15, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Suede Olive Drab",                    "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 26,  "unit_cost": 1020.00, "min_stock": 12, "supplier": "Beta Supplier"},
    {"material_name": "Suede Blush Pink",                    "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 17,  "unit_cost": 1080.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Suede Brick Red",                     "material_type": "suede",     "size": "9 sqft per hide",  "quantity": 31,  "unit_cost": 1030.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Suede Storm Grey",                    "material_type": "suede",     "size": "8 sqft per hide",  "quantity": 44,  "unit_cost": 1010.00, "min_stock": 18, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Split Suede Natural Brown",           "material_type": "suede",     "size": "10 sqft per hide", "quantity": 60,  "unit_cost": 680.00,  "min_stock": 20, "supplier": "Manila Leather Supply"},

    # ── Nappa (10) ────────────────────────────────────────────────────────────
    {"material_name": "Nappa Cobalt Blue Soft",              "material_type": "nappa",     "size": "9 sqft per hide",  "quantity": 22,  "unit_cost": 2100.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Nappa Forest Green",                  "material_type": "nappa",     "size": "10 sqft per hide", "quantity": 19,  "unit_cost": 2250.00, "min_stock": 10, "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Nappa Tan Supple",                    "material_type": "nappa",     "size": "10 sqft per hide", "quantity": 37,  "unit_cost": 2050.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Nappa Caramel Soft",                  "material_type": "nappa",     "size": "9 sqft per hide",  "quantity": 30,  "unit_cost": 2180.00, "min_stock": 12, "supplier": "Manila Leather Supply"},
    {"material_name": "Nappa Silver Metallic",               "material_type": "nappa",     "size": "8 sqft per hide",  "quantity": 9,   "unit_cost": 3100.00, "min_stock": 6,  "supplier": "Beta Supplier"},
    {"material_name": "Nappa Blush Pink",                    "material_type": "nappa",     "size": "9 sqft per hide",  "quantity": 14,  "unit_cost": 2300.00, "min_stock": 8,  "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Nappa Champagne",                     "material_type": "nappa",     "size": "10 sqft per hide", "quantity": 25,  "unit_cost": 2400.00, "min_stock": 10, "supplier": "Manila Leather Supply"},
    {"material_name": "Nappa Dark Chocolate",                "material_type": "nappa",     "size": "10 sqft per hide", "quantity": 32,  "unit_cost": 2200.00, "min_stock": 15, "supplier": "LuzonSkin Traders"},
    {"material_name": "Nappa Cherry Red",                    "material_type": "nappa",     "size": "9 sqft per hide",  "quantity": 18,  "unit_cost": 2350.00, "min_stock": 10, "supplier": "Beta Supplier"},
    {"material_name": "Nappa Taupe Matte",                   "material_type": "nappa",     "size": "10 sqft per hide", "quantity": 41,  "unit_cost": 2080.00, "min_stock": 18, "supplier": "Manila Leather Supply"},

    # ── Synthetic (15) ────────────────────────────────────────────────────────
    {"material_name": "PU Synthetic Red",                    "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 6,   "unit_cost": 3700.00, "min_stock": 3,  "supplier": "Beta Supplier"},
    {"material_name": "PU Synthetic Navy Blue",              "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 7,   "unit_cost": 3650.00, "min_stock": 3,  "supplier": "Beta Supplier"},
    {"material_name": "PU Synthetic Pure White",             "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 4,   "unit_cost": 3550.00, "min_stock": 2,  "supplier": "LuzonSkin Traders"},
    {"material_name": "PU Synthetic Charcoal Grey",          "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 9,   "unit_cost": 3600.00, "min_stock": 3,  "supplier": "Beta Supplier"},
    {"material_name": "PU Synthetic Olive Green",            "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 5,   "unit_cost": 3680.00, "min_stock": 2,  "supplier": "LuzonSkin Traders"},
    {"material_name": "PU Synthetic Tan",                    "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 6,   "unit_cost": 3580.00, "min_stock": 2,  "supplier": "Beta Supplier"},
    {"material_name": "PU Synthetic Burgundy",               "material_type": "synthetic", "size": "1 roll (50m)",     "quantity": 4,   "unit_cost": 3700.00, "min_stock": 2,  "supplier": "LuzonSkin Traders"},
    {"material_name": "PVC Synthetic Black Heavy",           "material_type": "synthetic", "size": "1 roll (30m)",     "quantity": 8,   "unit_cost": 2900.00, "min_stock": 3,  "supplier": "Beta Supplier"},
    {"material_name": "PVC Synthetic White",                 "material_type": "synthetic", "size": "1 roll (30m)",     "quantity": 5,   "unit_cost": 2850.00, "min_stock": 2,  "supplier": "Beta Supplier"},
    {"material_name": "Microfiber Black Velvet",             "material_type": "synthetic", "size": "1 roll (40m)",     "quantity": 4,   "unit_cost": 4100.00, "min_stock": 2,  "supplier": "LuzonSkin Traders"},
    {"material_name": "Microfiber Dark Brown",               "material_type": "synthetic", "size": "1 roll (40m)",     "quantity": 3,   "unit_cost": 4000.00, "min_stock": 2,  "supplier": "LuzonSkin Traders"},
    {"material_name": "Microfiber Navy",                     "material_type": "synthetic", "size": "1 roll (40m)",     "quantity": 3,   "unit_cost": 4050.00, "min_stock": 2,  "supplier": "LuzonSkin Traders"},
    {"material_name": "Cork Leather Natural",                "material_type": "synthetic", "size": "1 roll (25m)",     "quantity": 6,   "unit_cost": 5200.00, "min_stock": 2,  "supplier": "Beta Supplier"},
    {"material_name": "Recycled Leather Brown Sheet",        "material_type": "synthetic", "size": "1 roll (35m)",     "quantity": 10,  "unit_cost": 2400.00, "min_stock": 4,  "supplier": "LuzonSkin Traders"},
    {"material_name": "Vegan Bio-Leather Cream",             "material_type": "synthetic", "size": "1 roll (30m)",     "quantity": 5,   "unit_cost": 5800.00, "min_stock": 2,  "supplier": "Beta Supplier"},

    # ── Other / Special (15) ──────────────────────────────────────────────────
    {"material_name": "Python Print Leather Black",          "material_type": "other",     "size": "7 sqft per hide",  "quantity": 18,  "unit_cost": 2900.00, "min_stock": 8,  "supplier": "Manila Leather Supply"},
    {"material_name": "Snake Print Leather Brown",           "material_type": "other",     "size": "6 sqft per hide",  "quantity": 14,  "unit_cost": 2750.00, "min_stock": 6,  "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Ostrich Print Leather Black",         "material_type": "other",     "size": "7 sqft per hide",  "quantity": 12,  "unit_cost": 3200.00, "min_stock": 6,  "supplier": "Manila Leather Supply"},
    {"material_name": "Stingray Print Leather Grey",         "material_type": "other",     "size": "5 sqft per hide",  "quantity": 8,   "unit_cost": 3500.00, "min_stock": 4,  "supplier": "Beta Supplier"},
    {"material_name": "Pony Hair Leather Black and White",   "material_type": "other",     "size": "6 sqft per hide",  "quantity": 10,  "unit_cost": 3800.00, "min_stock": 4,  "supplier": "Manila Leather Supply"},
    {"material_name": "Laser-Cut Floral Leather Black",      "material_type": "other",     "size": "8 sqft per hide",  "quantity": 15,  "unit_cost": 3100.00, "min_stock": 6,  "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Two-Tone Leather Black and Gold",     "material_type": "other",     "size": "8 sqft per hide",  "quantity": 9,   "unit_cost": 3400.00, "min_stock": 4,  "supplier": "Beta Supplier"},
    {"material_name": "Holographic Leather Silver",          "material_type": "other",     "size": "6 sqft per hide",  "quantity": 7,   "unit_cost": 4200.00, "min_stock": 4,  "supplier": "Beta Supplier"},
    {"material_name": "Iridescent Leather Ocean Blue",       "material_type": "other",     "size": "6 sqft per hide",  "quantity": 6,   "unit_cost": 4000.00, "min_stock": 3,  "supplier": "Manila Leather Supply"},
    {"material_name": "Burnished Antiqued Leather Cognac",   "material_type": "other",     "size": "10 sqft per hide", "quantity": 22,  "unit_cost": 2600.00, "min_stock": 8,  "supplier": "Cebu Hide & Tannery Co."},
    {"material_name": "Hand-Painted Floral Leather Cream",   "material_type": "other",     "size": "7 sqft per hide",  "quantity": 5,   "unit_cost": 4500.00, "min_stock": 3,  "supplier": "Manila Leather Supply"},
    {"material_name": "Studded Leather Black",               "material_type": "other",     "size": "8 sqft per hide",  "quantity": 11,  "unit_cost": 3300.00, "min_stock": 5,  "supplier": "Beta Supplier"},
    {"material_name": "Eco Leather Olive Green",             "material_type": "other",     "size": "9 sqft per hide",  "quantity": 20,  "unit_cost": 2800.00, "min_stock": 8,  "supplier": "LuzonSkin Traders"},
    {"material_name": "Reflective Leather Silver Grey",      "material_type": "other",     "size": "7 sqft per hide",  "quantity": 8,   "unit_cost": 3600.00, "min_stock": 4,  "supplier": "Beta Supplier"},
    {"material_name": "Waxed Coated Leather Tan",            "material_type": "other",     "size": "10 sqft per hide", "quantity": 30,  "unit_cost": 2200.00, "min_stock": 10, "supplier": "LuzonSkin Traders"},
]



# ─── Command ──────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed the inventory with realistic leather materials for Otto Shoes IMS."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing materials and suppliers before seeding (use with caution).",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write(self.style.WARNING("[!] Clearing all materials and suppliers..."))
            Material.objects.all().delete()
            Supplier.objects.all().delete()
            self.stdout.write(self.style.WARNING("    Cleared.\n"))

        # Get the first superuser to use as added_by
        admin_user = User.objects.filter(is_superuser=True).first()

        # -- Seed suppliers ----------------------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING("-- Seeding Suppliers -----------------"))
        supplier_map = {}
        sup_created = 0
        for sup_data in SUPPLIERS:
            sup, created = Supplier.objects.get_or_create(
                name=sup_data["name"],
                defaults={
                    "contact_person": sup_data["contact_person"],
                    "phone":          sup_data["phone"],
                    "email":          sup_data["email"],
                    "address":        sup_data["address"],
                },
            )
            supplier_map[sup.name] = sup
            if created:
                sup_created += 1
                self.stdout.write(f"  [+] Created: {sup.name}")
            else:
                self.stdout.write(f"  [=] Exists:  {sup.name}")

        self.stdout.write(self.style.SUCCESS(f"\n  {sup_created} new supplier(s) added.\n"))

        # ── Seed materials ────────────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("-- Seeding Materials -----------------"))
        mat_created = 0
        mat_skipped = 0

        for mat_data in MATERIALS:
            supplier = supplier_map.get(mat_data["supplier"])
            mat, created = Material.objects.get_or_create(
                material_name=mat_data["material_name"],
                material_type=mat_data["material_type"],
                supplier=supplier,
                defaults={
                    "size":      mat_data.get("size", ""),
                    "quantity":  mat_data["quantity"],
                    "unit_cost": mat_data["unit_cost"],
                    "min_stock": mat_data["min_stock"],
                    "added_by":  admin_user,
                },
            )

            status_icon = "[+]" if created else "[=]"
            status_word = "Created" if created else "Exists "
            qty_str = f"Qty: {mat.quantity:>4}  Min: {mat.min_stock:>3}  PHP {float(mat.unit_cost):,.2f}"
            self.stdout.write(f"  {status_icon} {status_word}: {mat.material_name:<38} {qty_str}")

            if created:
                mat_created += 1
                # Log to audit trail
                if admin_user:
                    AuditLog.objects.create(
                        user=admin_user,
                        username=admin_user.username,
                        action=AuditLog.ActionType.MATERIAL_ADDED,
                        details=(
                            f"[SEED] Added {mat.material_name} "
                            f"(type={mat.material_type}, qty={mat.quantity}, "
                            f"unit_cost=PHP {float(mat.unit_cost):,.2f})"
                        ),
                    )
            else:
                mat_skipped += 1

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"[OK] Done! {mat_created} material(s) created, {mat_skipped} already existed."
        ))
        total = Material.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f"     Total materials in database: {total}"
        ))
        self.stdout.write(
            "\n  Tip: Re-run the analytics pipeline to update AI context:\n"
            "       python manage.py shell -c \"from apps.analytics.extract_data import run_pipeline; run_pipeline()\""
        )
