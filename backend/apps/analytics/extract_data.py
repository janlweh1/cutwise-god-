#!/usr/bin/env python
"""
================================================================
  CutWise IMS - Data Extraction & Analytics Script
  Capstone 2: Analytics & AI Layer
  
  Aligned with Arch 1: Data Pipeline + Analytics Engine
  
  This script reads from PostgreSQL (read-only) and writes
  analytics predictions to SQLite (analytics.db).
  
  Architecture mapping:
    - Data Pipeline  -> ETL Jobs, Data Aggregation, Feature Store
    - Analytics Engine -> Demand Forecasting, Stock Optimization,
                          Trend Analysis
  
  PostgreSQL is Capstone 1 (untouched, read-only SELECT only).
  SQLite is the new Capstone 2 analytics database.
================================================================

Usage:
    cd backend
    python -m apps.analytics.extract_data

Requirements:
    pip install pandas scikit-learn numpy
"""

import os
import sys
import sqlite3
import logging
from datetime import datetime, timedelta
from pathlib import Path
from decimal import Decimal

# -- Ensure Django is set up --
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from django.contrib.auth.models import User
from apps.inventory.models import Material, Supplier, Scrap, ScrapSale, AuditLog

# -- Logging Configuration --
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "extract_script.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# -- SQLite Configuration --
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
SQLITE_PATH = DATA_DIR / "analytics.db"


# ============================================================
# PHASE 1: DATA EXTRACTION (PostgreSQL -> Pandas DataFrames)
# ============================================================

def extract_materials():
    """Extract all materials from PostgreSQL (read-only SELECT)."""
    logger.info("Extracting materials from PostgreSQL...")

    materials = Material.objects.select_related("supplier", "added_by").all()
    records = []
    for m in materials:
        records.append({
            "material_id": str(m.id),
            "material_name": m.material_name,
            "material_type": m.material_type,
            "supplier_name": m.supplier.name if m.supplier else "Unknown",
            "supplier_id": str(m.supplier.id) if m.supplier else None,
            "quantity": m.quantity,
            "unit_cost": float(m.unit_cost),
            "min_stock": m.min_stock,
            "total_value": float(m.total_value),
            "stock_status": m.stock_status,
            "size": m.size,
            "last_update": m.last_update.isoformat() if m.last_update else None,
            "added_by": m.added_by.username if m.added_by else "Unknown",
        })

    df = pd.DataFrame(records)
    logger.info(f"  -> Extracted {len(df)} materials")
    return df


def extract_suppliers():
    """Extract all suppliers from PostgreSQL (read-only SELECT)."""
    logger.info("Extracting suppliers from PostgreSQL...")

    suppliers = Supplier.objects.all()
    records = []
    for s in suppliers:
        records.append({
            "supplier_id": str(s.id),
            "name": s.name,
            "contact_person": s.contact_person,
            "phone": s.phone,
            "email": s.email,
            "address": s.address,
            "material_count": s.materials.count(),
        })

    df = pd.DataFrame(records)
    logger.info(f"  -> Extracted {len(df)} suppliers")
    return df


def extract_scraps():
    """Extract all scrap records from PostgreSQL (read-only SELECT)."""
    logger.info("Extracting scraps from PostgreSQL...")

    scraps = Scrap.objects.select_related("material").all()
    records = []
    for s in scraps:
        records.append({
            "scrap_id": str(s.id),
            "material_id": str(s.material.id),
            "material_name": s.material.material_name,
            "weight_kg": float(s.weight_kg),
            "recorded_date": s.recorded_date.isoformat() if s.recorded_date else None,
            "status": s.status,
        })

    df = pd.DataFrame(records)
    logger.info(f"  -> Extracted {len(df)} scraps")
    return df


def extract_scrap_sales():
    """Extract all scrap sale records from PostgreSQL (read-only SELECT)."""
    logger.info("Extracting scrap sales from PostgreSQL...")

    sales = ScrapSale.objects.select_related("scrap", "sold_by").all()
    records = []
    for sale in sales:
        records.append({
            "sale_id": str(sale.id),
            "scrap_id": str(sale.scrap.id),
            "sold_by": sale.sold_by.username if sale.sold_by else "Unknown",
            "quantity_sold": float(sale.quantity_sold),
            "sale_price_per_kg": float(sale.sale_price_per_kg),
            "total_amount": float(sale.total_amount),
            "profit": float(sale.profit),
            "sale_date": sale.sale_date.isoformat() if sale.sale_date else None,
        })

    df = pd.DataFrame(records)
    logger.info(f"  -> Extracted {len(df)} scrap sales")
    return df


def extract_audit_logs():
    """Extract all audit log records from PostgreSQL (read-only SELECT)."""
    logger.info("Extracting audit logs from PostgreSQL...")

    logs = AuditLog.objects.all()
    records = []
    for log in logs:
        records.append({
            "log_id": str(log.id),
            "username": log.username,
            "action": log.action,
            "action_display": log.get_action_display(),
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        })

    df = pd.DataFrame(records)
    logger.info(f"  -> Extracted {len(df)} audit logs")
    return df


# ============================================================
# PHASE 2: ANALYTICS & AI PREDICTIONS
# ============================================================

def analyze_stock_risk(df_materials):
    """
    Low-stock risk scoring (Analytics Engine -> Stock Optimization).
    Scores each material based on how close it is to its min_stock threshold.

    Risk Score = 1 - (quantity / max(min_stock * 2, 1))
    Clamped to [0, 1] range.
    """
    logger.info("Running low-stock risk analysis...")

    if df_materials.empty:
        logger.warning("  -> No materials to analyze")
        return pd.DataFrame()

    df = df_materials.copy()

    # Calculate risk score (higher = more at risk)
    df["stock_ratio"] = df.apply(
        lambda row: row["quantity"] / max(row["min_stock"], 1), axis=1
    )
    df["risk_score"] = df["stock_ratio"].apply(
        lambda r: round(max(0, min(1, 1 - (r - 1) / 2)), 4)
    )
    df["risk_level"] = df["risk_score"].apply(
        lambda s: "CRITICAL" if s >= 0.8
        else "HIGH" if s >= 0.6
        else "MEDIUM" if s >= 0.4
        else "LOW"
    )
    df["at_risk"] = df["stock_status"].isin(["low_stock", "out_of_stock"])
    df["buffer_units"] = df["quantity"] - df["min_stock"]

    risk_df = df[[
        "material_id", "material_name", "material_type", "supplier_name",
        "quantity", "min_stock", "stock_status", "unit_cost", "total_value",
        "stock_ratio", "risk_score", "risk_level", "at_risk", "buffer_units",
    ]].copy()

    critical = len(risk_df[risk_df["risk_level"] == "CRITICAL"])
    high = len(risk_df[risk_df["risk_level"] == "HIGH"])
    logger.info(f"  -> Risk analysis complete: {critical} CRITICAL, {high} HIGH risk materials")

    return risk_df


def predict_stock_depletion(df_materials, df_audit):
    """
    Stock depletion forecasting using Linear Regression
    (Analytics Engine -> Demand Forecasting).

    Uses audit log activity (material_updated, stock_adjusted events) as a
    proxy for consumption rate, then predicts when stock will hit min_stock.
    """
    logger.info("Running stock depletion forecasting (Linear Regression)...")

    if df_materials.empty:
        logger.warning("  -> No materials for forecasting")
        return pd.DataFrame()

    predictions = []

    for _, material in df_materials.iterrows():
        mat_id = material["material_id"]
        mat_name = material["material_name"]
        current_qty = material["quantity"]
        min_stock = material["min_stock"]

        # Get relevant audit events for this material
        if not df_audit.empty:
            material_events = df_audit[
                df_audit["details"].str.contains(mat_name, case=False, na=False)
                & df_audit["action"].isin([
                    "material_updated", "stock_adjusted", "material_added"
                ])
            ].copy()
        else:
            material_events = pd.DataFrame()

        # Calculate consumption rate
        if len(material_events) >= 2:
            material_events["timestamp_dt"] = pd.to_datetime(material_events["timestamp"])
            material_events = material_events.sort_values("timestamp_dt")

            # Use event frequency as proxy for consumption
            time_span = (
                material_events["timestamp_dt"].max()
                - material_events["timestamp_dt"].min()
            ).days

            if time_span > 0:
                events_per_day = len(material_events) / time_span
                # Estimate ~2-5 units consumed per event (stock adjustment)
                estimated_daily_consumption = events_per_day * 3
            else:
                estimated_daily_consumption = 0.5  # Default fallback
        else:
            # Not enough history -- use conservative estimate
            estimated_daily_consumption = 0.5

        # Linear Regression prediction
        # Create synthetic time series based on estimated consumption
        days = np.arange(0, 30).reshape(-1, 1)  # Next 30 days
        if estimated_daily_consumption > 0:
            projected_stock = current_qty - (estimated_daily_consumption * days.flatten())
            projected_stock = np.maximum(projected_stock, 0)  # Can't go below 0

            # Fit linear regression
            model = LinearRegression()
            model.fit(days, projected_stock)

            # Predict when stock hits min_stock
            if model.coef_[0] < 0:  # Stock is declining
                days_to_min = (current_qty - min_stock) / abs(estimated_daily_consumption)
                depletion_date = (
                    datetime.now() + timedelta(days=max(0, days_to_min))
                ).strftime("%Y-%m-%d")
                days_to_depletion = current_qty / abs(estimated_daily_consumption)
            else:
                depletion_date = "N/A (Stable)"
                days_to_min = 999
                days_to_depletion = 999

            # 7-day and 14-day forecast
            predicted_7d = max(0, round(current_qty - estimated_daily_consumption * 7))
            predicted_14d = max(0, round(current_qty - estimated_daily_consumption * 14))
            predicted_30d = max(0, round(current_qty - estimated_daily_consumption * 30))
        else:
            depletion_date = "N/A (No consumption)"
            days_to_min = 999
            days_to_depletion = 999
            predicted_7d = current_qty
            predicted_14d = current_qty
            predicted_30d = current_qty
            estimated_daily_consumption = 0

        predictions.append({
            "material_id": mat_id,
            "material_name": mat_name,
            "material_type": material["material_type"],
            "current_stock": current_qty,
            "min_stock": min_stock,
            "daily_consumption_rate": round(estimated_daily_consumption, 4),
            "predicted_stock_7d": predicted_7d,
            "predicted_stock_14d": predicted_14d,
            "predicted_stock_30d": predicted_30d,
            "days_until_min_stock": round(max(0, days_to_min), 1),
            "days_until_depletion": round(max(0, days_to_depletion), 1),
            "estimated_depletion_date": depletion_date,
            "reorder_recommended": days_to_min < 14,
            "confidence": "HIGH" if len(material_events) >= 5
                          else "MEDIUM" if len(material_events) >= 2
                          else "LOW",
            "model_type": "LinearRegression",
            "run_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

    df_predictions = pd.DataFrame(predictions)
    reorder_count = df_predictions["reorder_recommended"].sum()
    logger.info(f"  -> Generated predictions for {len(df_predictions)} materials")
    logger.info(f"  -> {reorder_count} materials recommended for reorder")

    return df_predictions


def analyze_audit_activity(df_audit):
    """
    Analyze audit log patterns (Analytics Engine -> Trend Analysis).
    Tracks user activity, action distribution, and time-based trends.
    """
    logger.info("Running audit log activity analysis...")

    if df_audit.empty:
        logger.warning("  -> No audit logs to analyze")
        return pd.DataFrame()

    df = df_audit.copy()
    df["timestamp_dt"] = pd.to_datetime(df["timestamp"])
    df["date"] = df["timestamp_dt"].dt.date
    df["hour"] = df["timestamp_dt"].dt.hour

    # Activity by user
    user_activity = df.groupby("username").agg(
        total_actions=("log_id", "count"),
        first_action=("timestamp_dt", "min"),
        last_action=("timestamp_dt", "max"),
    ).reset_index()
    user_activity["first_action"] = user_activity["first_action"].dt.strftime("%Y-%m-%d %H:%M:%S")
    user_activity["last_action"] = user_activity["last_action"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Activity by action type
    action_counts = df["action_display"].value_counts().reset_index()
    action_counts.columns = ["action_type", "count"]

    # Daily activity trend
    daily_trend = df.groupby("date").size().reset_index(name="event_count")
    daily_trend["date"] = daily_trend["date"].astype(str)

    logger.info(f"  -> Analyzed {len(df)} audit events across {len(user_activity)} users")

    return {
        "user_activity": user_activity,
        "action_counts": action_counts,
        "daily_trend": daily_trend,
    }


def generate_summary_report(df_materials, df_risk, df_predictions, df_scraps, df_sales):
    """Generate aggregated KPI summary for the dashboard."""
    logger.info("Generating summary report...")

    summary = {
        "run_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_materials": len(df_materials),
        "total_inventory_value": round(df_materials["total_value"].sum(), 2) if not df_materials.empty else 0,
        "avg_unit_cost": round(df_materials["unit_cost"].mean(), 2) if not df_materials.empty else 0,
        "total_quantity_units": int(df_materials["quantity"].sum()) if not df_materials.empty else 0,

        # Risk metrics
        "materials_at_risk": int(df_risk["at_risk"].sum()) if not df_risk.empty else 0,
        "critical_risk_count": int(len(df_risk[df_risk["risk_level"] == "CRITICAL"])) if not df_risk.empty else 0,
        "high_risk_count": int(len(df_risk[df_risk["risk_level"] == "HIGH"])) if not df_risk.empty else 0,
        "avg_risk_score": round(df_risk["risk_score"].mean(), 4) if not df_risk.empty else 0,

        # Prediction metrics
        "reorder_recommended_count": int(df_predictions["reorder_recommended"].sum()) if not df_predictions.empty else 0,
        "avg_days_to_min_stock": round(df_predictions["days_until_min_stock"].mean(), 1) if not df_predictions.empty else 0,

        # Scrap metrics
        "total_scraps": len(df_scraps),
        "total_scrap_weight_kg": round(float(df_scraps["weight_kg"].sum()), 3) if not df_scraps.empty else 0,
        "total_sales": len(df_sales),
        "total_sales_revenue": round(float(df_sales["total_amount"].sum()), 2) if not df_sales.empty else 0,

        # Stock status distribution
        "in_stock_count": int(len(df_materials[df_materials["stock_status"] == "in_stock"])) if not df_materials.empty else 0,
        "low_stock_count": int(len(df_materials[df_materials["stock_status"] == "low_stock"])) if not df_materials.empty else 0,
        "out_of_stock_count": int(len(df_materials[df_materials["stock_status"] == "out_of_stock"])) if not df_materials.empty else 0,
    }

    logger.info(f"  -> Summary: {summary['total_materials']} materials, "
                f"PHP {summary['total_inventory_value']:,.2f} total value, "
                f"{summary['materials_at_risk']} at risk")

    return pd.DataFrame([summary])


# ============================================================
# PHASE 3: SAVE TO SQLITE (Feature Store)
# ============================================================

def save_to_sqlite(df_materials, df_suppliers, df_scraps, df_sales, df_audit,
                   df_risk, df_predictions, audit_analysis, df_summary):
    """Save all extracted and analyzed data to SQLite database (Feature Store)."""
    logger.info(f"Saving results to SQLite: {SQLITE_PATH}")

    try:
        conn = sqlite3.connect(str(SQLITE_PATH))
        conn.execute("PRAGMA journal_mode=WAL")

        # Helper to safely write a DataFrame (skip empty ones to avoid SQLite errors)
        def safe_to_sql(df, table_name, connection):
            if df.empty:
                connection.execute(f"DROP TABLE IF EXISTS [{table_name}]")
                logger.info(f"  -> Skipped '{table_name}' (0 records)")
                return 0
            df.to_sql(table_name, connection, if_exists="replace", index=False)
            logger.info(f"  -> Saved {len(df)} records to '{table_name}' table")
            return len(df)

        # -- Raw extracted data (mirrors of PostgreSQL) --
        safe_to_sql(df_materials, "raw_materials", conn)
        safe_to_sql(df_suppliers, "raw_suppliers", conn)
        safe_to_sql(df_scraps, "raw_scraps", conn)
        safe_to_sql(df_sales, "raw_scrap_sales", conn)
        safe_to_sql(df_audit, "raw_audit_logs", conn)

        # -- Analytics results --
        safe_to_sql(df_risk, "risk_scores", conn)
        safe_to_sql(df_predictions, "material_predictions", conn)

        # -- Audit analysis tables --
        if isinstance(audit_analysis, dict):
            safe_to_sql(audit_analysis["user_activity"], "user_activity", conn)
            safe_to_sql(audit_analysis["action_counts"], "action_distribution", conn)
            safe_to_sql(audit_analysis["daily_trend"], "daily_activity_trend", conn)
            logger.info("  -> Saved audit analysis tables")

        # -- Summary report --
        safe_to_sql(df_summary, "summary_reports", conn)

        # -- Extraction log (metadata) --
        extraction_meta = pd.DataFrame([{
            "run_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source_db": "PostgreSQL (cutwise_db)",
            "target_db": f"SQLite ({SQLITE_PATH.name})",
            "materials_extracted": len(df_materials),
            "suppliers_extracted": len(df_suppliers),
            "scraps_extracted": len(df_scraps),
            "sales_extracted": len(df_sales),
            "audit_logs_extracted": len(df_audit),
            "predictions_generated": len(df_predictions),
            "risk_scores_generated": len(df_risk),
            "status": "SUCCESS",
        }])
        extraction_meta.to_sql("extraction_log", conn, if_exists="append", index=False)
        logger.info("  -> Saved extraction metadata")

        conn.close()
        logger.info("SQLite save complete [OK]")

    except Exception as e:
        logger.error(f"SQLite Error: {e}")
        raise


# ============================================================
# PHASE 4: DATA VALIDATION
# ============================================================

def validate_data(df_materials, df_suppliers, df_scraps, df_sales, df_audit):
    """
    Validate extracted data by comparing PostgreSQL counts with
    the extracted DataFrame row counts.
    """
    logger.info("=" * 60)
    logger.info("DATA VALIDATION REPORT")
    logger.info("=" * 60)

    # Source counts (from PostgreSQL via Django ORM)
    pg_counts = {
        "Materials": Material.objects.count(),
        "Suppliers": Supplier.objects.count(),
        "Scraps": Scrap.objects.count(),
        "ScrapSales": ScrapSale.objects.count(),
        "AuditLogs": AuditLog.objects.count(),
    }

    # Extracted counts
    extracted_counts = {
        "Materials": len(df_materials),
        "Suppliers": len(df_suppliers),
        "Scraps": len(df_scraps),
        "ScrapSales": len(df_sales),
        "AuditLogs": len(df_audit),
    }

    all_pass = True
    logger.info(f"\n{'Table':<15} {'PostgreSQL':>12} {'Extracted':>12} {'Status':>10}")
    logger.info("-" * 52)

    for table in pg_counts:
        pg = pg_counts[table]
        ext = extracted_counts[table]
        match = "[PASS]" if pg == ext else "[FAIL]"
        if pg != ext:
            all_pass = False
        logger.info(f"{table:<15} {pg:>12} {ext:>12} {match:>10}")

    logger.info("-" * 52)

    # SQLite verification
    if SQLITE_PATH.exists():
        conn = sqlite3.connect(str(SQLITE_PATH))
        cursor = conn.cursor()
        tables = cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        logger.info(f"\nSQLite Tables Created: {len(tables)}")
        for t in tables:
            count = cursor.execute(f"SELECT COUNT(*) FROM [{t[0]}]").fetchone()[0]
            logger.info(f"  -> {t[0]}: {count} records")
        conn.close()

    # Sample data comparison
    if not df_materials.empty:
        logger.info("\nSample Material Records (first 3):")
        logger.info("-" * 52)
        for _, row in df_materials.head(3).iterrows():
            logger.info(
                f"  {row['material_name']}: qty={row['quantity']}, "
                f"min_stock={row['min_stock']}, status={row['stock_status']}"
            )

    # Quality checks
    logger.info("\nData Quality Checks:")
    logger.info("-" * 52)

    checks = [
        ("No null material IDs",
         not df_materials.empty and df_materials["material_id"].notna().all()),
        ("No negative quantities",
         df_materials.empty or (df_materials["quantity"] >= 0).all()),
        ("No negative costs",
         df_materials.empty or (df_materials["unit_cost"] >= 0).all()),
        ("All materials have names",
         df_materials.empty or df_materials["material_name"].notna().all()),
        ("All audit logs have timestamps",
         df_audit.empty or df_audit["timestamp"].notna().all()),
    ]

    for check_name, passed in checks:
        status = "[PASS]" if passed else "[FAIL]"
        if not passed:
            all_pass = False
        logger.info(f"  {status}  {check_name}")

    logger.info("=" * 60)
    overall = "ALL VALIDATIONS PASSED" if all_pass else "SOME VALIDATIONS FAILED"
    logger.info(f"OVERALL: {overall}")
    logger.info("=" * 60)

    return all_pass


# ============================================================
# MAIN EXECUTION
# ============================================================

def main():
    logger.info("=" * 60)
    logger.info("CutWise IMS - Data Extraction Script Started")
    logger.info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Source: PostgreSQL (cutwise_db)")
    logger.info(f"Target: SQLite ({SQLITE_PATH})")
    logger.info("=" * 60)

    try:
        # -- Phase 1: Extract --
        logger.info("\n" + "-" * 40)
        logger.info("PHASE 1: DATA EXTRACTION")
        logger.info("-" * 40)
        df_materials = extract_materials()
        df_suppliers = extract_suppliers()
        df_scraps = extract_scraps()
        df_sales = extract_scrap_sales()
        df_audit = extract_audit_logs()

        total_extracted = (
            len(df_materials) + len(df_suppliers) + len(df_scraps)
            + len(df_sales) + len(df_audit)
        )
        logger.info(f"\nTotal records extracted: {total_extracted}")

        # -- Phase 2: Analyze --
        logger.info("\n" + "-" * 40)
        logger.info("PHASE 2: ANALYTICS & AI PREDICTIONS")
        logger.info("-" * 40)
        df_risk = analyze_stock_risk(df_materials)
        df_predictions = predict_stock_depletion(df_materials, df_audit)
        audit_analysis = analyze_audit_activity(df_audit)
        df_summary = generate_summary_report(
            df_materials, df_risk, df_predictions, df_scraps, df_sales
        )

        # -- Phase 3: Save --
        logger.info("\n" + "-" * 40)
        logger.info("PHASE 3: SAVE TO SQLITE")
        logger.info("-" * 40)
        save_to_sqlite(
            df_materials, df_suppliers, df_scraps, df_sales, df_audit,
            df_risk, df_predictions, audit_analysis, df_summary,
        )

        # -- Phase 4: Validate --
        logger.info("\n" + "-" * 40)
        logger.info("PHASE 4: DATA VALIDATION")
        logger.info("-" * 40)
        all_pass = validate_data(
            df_materials, df_suppliers, df_scraps, df_sales, df_audit
        )

        # -- Done --
        logger.info("\n" + "=" * 60)
        logger.info("Script completed successfully [OK]")
        logger.info("=" * 60)
        return 0 if all_pass else 1

    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
