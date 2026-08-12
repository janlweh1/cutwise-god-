#!/usr/bin/env python
"""
================================================================
  CutWise IMS - AI Inference Script
  Capstone 2: Sprint 3 — AI Recommendation Engine (WBS 4.3)

  Standalone inference script that:
    1. Loads material data from analytics.db (Feature Store)
    2. Runs Linear Regression stock depletion forecasting
    3. Runs risk scoring classification
    4. Returns structured JSON predictions

  Architecture Mapping:
    Analytics Engine -> Demand Forecasting -> Reorder Recommendations
    Analytics Engine -> Stock Optimization -> Risk Classification

  Usage:
    # Predict for a specific material:
    cd backend
    python -m apps.analytics.inference --material "Bonded Leather"

    # Predict for all materials:
    python -m apps.analytics.inference --all

    # Export to JSON:
    python -m apps.analytics.inference --all --output data/predictions_output.json

    # Run as module (from backend/):
    python -m apps.analytics.inference --all --verbose
================================================================
"""

import argparse
import json
import sqlite3
import sys
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

# ── Path setup ───────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SQLITE_PATH = BASE_DIR / "data" / "analytics.db"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ============================================================
# MODEL: Linear Regression (implemented from scratch to be
#        standalone — no Django dependency needed)
# ============================================================

class LinearRegressionModel:
    """
    Lightweight Linear Regression for stock depletion forecasting.
    Predicts future stock levels based on historical consumption rate.

    Model:
      stock(t) = current_stock - (consumption_rate * t)

    Where:
      t = days into the future
      consumption_rate = estimated daily units consumed
                         (derived from audit log activity frequency)
    """

    def __init__(self):
        self.slope = 0.0          # Daily consumption rate (units/day)
        self.intercept = 0.0      # Current stock level
        self.is_fitted = False

    def fit(self, days: np.ndarray, stock_levels: np.ndarray):
        """Fit the model using Ordinary Least Squares."""
        n = len(days)
        if n < 2:
            self.slope = 0.0
            self.intercept = float(stock_levels[0]) if n > 0 else 0.0
            self.is_fitted = True
            return self

        x_mean = np.mean(days)
        y_mean = np.mean(stock_levels)

        numerator = np.sum((days - x_mean) * (stock_levels - y_mean))
        denominator = np.sum((days - x_mean) ** 2)

        self.slope = numerator / denominator if denominator != 0 else 0.0
        self.intercept = y_mean - self.slope * x_mean
        self.is_fitted = True
        return self

    def predict(self, days: np.ndarray) -> np.ndarray:
        """Predict stock levels at given future days."""
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predicting.")
        return np.maximum(self.intercept + self.slope * days, 0)

    def days_to_reach(self, target_stock: float) -> float:
        """Estimate how many days until stock drops to target_stock."""
        if self.slope >= 0 or self.intercept <= target_stock:
            return 999.0  # Stock is stable or already below target
        return (self.intercept - target_stock) / abs(self.slope)


# ============================================================
# DATA LOADING (from analytics.db Feature Store)
# ============================================================

def _connect() -> sqlite3.Connection:
    """Open a read-only connection to analytics.db."""
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(
            f"Analytics database not found at {SQLITE_PATH}. "
            "Run extract_data.py first to populate it."
        )
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def load_materials() -> list[dict]:
    """Load all raw materials from the feature store."""
    conn = _connect()
    rows = conn.execute("SELECT * FROM raw_materials").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def load_audit_logs() -> list[dict]:
    """Load audit logs for consumption rate estimation."""
    conn = _connect()
    rows = conn.execute("SELECT * FROM raw_audit_logs").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def load_existing_predictions() -> list[dict]:
    """Load pre-computed predictions from last ETL run."""
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM material_predictions").fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        conn.close()
        return []


def load_existing_risk_scores() -> list[dict]:
    """Load pre-computed risk scores from last ETL run."""
    conn = _connect()
    try:
        rows = conn.execute("SELECT * FROM risk_scores").fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        conn.close()
        return []


# ============================================================
# RISK SCORING ENGINE
# ============================================================

def score_risk(material: dict) -> dict:
    """
    Classify stock risk for a single material.

    Risk Score Formula:
      stock_ratio = quantity / max(min_stock, 1)
      risk_score  = clamp(1 - (stock_ratio - 1) / 2, 0, 1)

    Risk Levels:
      CRITICAL  : risk_score >= 0.8  (immediate action required)
      HIGH      : risk_score >= 0.6  (order within 3 days)
      MEDIUM    : risk_score >= 0.4  (monitor closely)
      LOW       : risk_score <  0.4  (adequate stock)
    """
    qty = max(int(material.get("quantity", 0)), 0)
    min_stock = max(int(material.get("min_stock", 10)), 1)
    stock_status = material.get("stock_status", "in_stock")

    stock_ratio = qty / min_stock
    raw_risk = 1 - (stock_ratio - 1) / 2
    risk_score = round(max(0.0, min(1.0, raw_risk)), 4)

    if risk_score >= 0.8:
        risk_level = "CRITICAL"
    elif risk_score >= 0.6:
        risk_level = "HIGH"
    elif risk_score >= 0.4:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    at_risk = stock_status in ("low_stock", "out_of_stock")
    buffer_units = qty - min_stock

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "at_risk": at_risk,
        "buffer_units": buffer_units,
        "stock_ratio": round(stock_ratio, 4),
    }


# ============================================================
# DEMAND FORECASTING ENGINE
# ============================================================

def estimate_consumption_rate(material_name: str, audit_logs: list[dict]) -> tuple[float, str]:
    """
    Estimate daily consumption rate from audit log frequency.

    Strategy:
      - Filter audit events related to this material
      - Measure event frequency (events/day) as a consumption proxy
      - Multiply by estimated units-per-event (~3 units)

    Returns:
      (daily_consumption_rate, confidence_level)
    """
    name_lower = material_name.lower()
    relevant = [
        log for log in audit_logs
        if name_lower in log.get("details", "").lower()
        and log.get("action", "") in (
            "material_updated", "stock_adjusted", "material_added"
        )
    ]

    if len(relevant) >= 2:
        timestamps = sorted([
            datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00"))
            for log in relevant
            if log.get("timestamp")
        ])
        time_span_days = max(
            (timestamps[-1] - timestamps[0]).days, 1
        )
        events_per_day = len(relevant) / time_span_days
        # ~3 units consumed per stock adjustment event
        daily_rate = round(events_per_day * 3, 4)
        confidence = "HIGH" if len(relevant) >= 5 else "MEDIUM"
    else:
        daily_rate = 0.5  # Conservative fallback
        confidence = "LOW"

    return daily_rate, confidence


def forecast_depletion(material: dict, audit_logs: list[dict]) -> dict:
    """
    Run Linear Regression to forecast stock depletion for one material.

    Returns a structured prediction dictionary.
    """
    mat_name = material.get("material_name", "Unknown")
    current_qty = max(int(material.get("quantity", 0)), 0)
    min_stock = max(int(material.get("min_stock", 10)), 1)

    daily_rate, confidence = estimate_consumption_rate(mat_name, audit_logs)

    # Build synthetic time series (30-day window)
    days = np.arange(0, 31, dtype=float)
    projected = np.maximum(current_qty - daily_rate * days, 0)

    # Fit model
    model = LinearRegressionModel()
    model.fit(days, projected)

    # Predictions
    pred_7d  = int(max(round(model.predict(np.array([7.0]))[0]), 0))
    pred_14d = int(max(round(model.predict(np.array([14.0]))[0]), 0))
    pred_30d = int(max(round(model.predict(np.array([30.0]))[0]), 0))

    # Days until min_stock / depletion
    days_to_min = model.days_to_reach(float(min_stock))
    days_to_zero = model.days_to_reach(0.0)

    if days_to_min < 999:
        depletion_date = (
            datetime.now() + timedelta(days=max(0, days_to_min))
        ).strftime("%Y-%m-%d")
    else:
        depletion_date = "N/A (Stable)"

    reorder_recommended = bool(days_to_min < 14)

    return {
        "material_id":              material.get("material_id", ""),
        "material_name":            mat_name,
        "material_type":            material.get("material_type", ""),
        "supplier_name":            material.get("supplier_name", ""),
        "current_stock":            current_qty,
        "min_stock":                min_stock,
        "unit_cost":                float(material.get("unit_cost", 0)),
        "total_value":              float(material.get("total_value", 0)),
        "stock_status":             material.get("stock_status", ""),
        # --- Model outputs ---
        "model_type":               "LinearRegression",
        "daily_consumption_rate":   daily_rate,
        "predicted_stock_7d":       pred_7d,
        "predicted_stock_14d":      pred_14d,
        "predicted_stock_30d":      pred_30d,
        "days_until_min_stock":     round(days_to_min, 1),
        "days_until_depletion":     round(days_to_zero, 1),
        "estimated_reorder_date":   depletion_date,
        "reorder_recommended":      reorder_recommended,
        "confidence":               confidence,
        # --- Risk scoring ---
        **score_risk(material),
        # --- Metadata ---
        "inference_timestamp":      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ============================================================
# PUBLIC API
# ============================================================

def predict(material_name: str) -> dict | None:
    """
    Run inference for a single material by name.

    Args:
        material_name: Exact or partial material name (case-insensitive).

    Returns:
        Prediction dictionary, or None if material not found.

    Example:
        >>> result = predict("Bonded Leather")
        >>> print(result["risk_level"])
        'CRITICAL'
    """
    materials = load_materials()
    audit_logs = load_audit_logs()
    name_lower = material_name.lower()

    matches = [m for m in materials if name_lower in m.get("material_name", "").lower()]
    if not matches:
        logger.warning(f"No material found matching '{material_name}'")
        return None

    return forecast_depletion(matches[0], audit_logs)


def batch_predict() -> list[dict]:
    """
    Run inference for all materials in the feature store.

    Returns:
        List of prediction dictionaries for every material.

    Example:
        >>> results = batch_predict()
        >>> critical = [r for r in results if r["risk_level"] == "CRITICAL"]
        >>> print(f"{len(critical)} materials need immediate reorder")
    """
    materials = load_materials()
    audit_logs = load_audit_logs()

    predictions = []
    for mat in materials:
        prediction = forecast_depletion(mat, audit_logs)
        predictions.append(prediction)

    # Sort: reorder needed first, then by days_until_min_stock
    predictions.sort(
        key=lambda x: (not x["reorder_recommended"], x["days_until_min_stock"])
    )
    return predictions


def print_prediction(pred: dict, verbose: bool = False):
    """Pretty-print a single prediction result to stdout."""
    risk_icons = {
        "CRITICAL": "[CRITICAL]",
        "HIGH":     "[HIGH]   ",
        "MEDIUM":   "[MEDIUM] ",
        "LOW":      "[LOW]    ",
    }
    icon = risk_icons.get(pred.get("risk_level", "LOW"), "[?]")
    reorder = "*** REORDER NOW ***" if pred["reorder_recommended"] else "OK"

    print(f"\n{'-'*60}")
    print(f"  {icon}  {pred['material_name']} [{pred['material_type']}]")
    print(f"{'-'*60}")
    print(f"  Supplier        : {pred['supplier_name']}")
    print(f"  Stock Status    : {pred['stock_status'].upper()}")
    print(f"  Current Stock   : {pred['current_stock']} units")
    print(f"  Min Stock       : {pred['min_stock']} units")
    print(f"  Buffer Units    : {pred['buffer_units']} units")
    print(f"  Unit Cost       : PHP {pred['unit_cost']:,.2f}")
    print(f"  Total Value     : PHP {pred['total_value']:,.2f}")
    print(f"  {'-'*38}")
    print(f"  Model           : {pred['model_type']}")
    print(f"  Daily Rate      : {pred['daily_consumption_rate']} units/day")
    print(f"  Predicted 7d    : {pred['predicted_stock_7d']} units")
    print(f"  Predicted 14d   : {pred['predicted_stock_14d']} units")
    print(f"  Predicted 30d   : {pred['predicted_stock_30d']} units")
    print(f"  Days to Min     : {pred['days_until_min_stock']} days")
    print(f"  Reorder Date    : {pred['estimated_reorder_date']}")
    print(f"  {'-'*38}")
    print(f"  Risk Score      : {pred['risk_score']} ({pred['risk_level']})")
    print(f"  Confidence      : {pred['confidence']}")
    print(f"  Recommendation  : {reorder}")
    if verbose:
        print(f"  Inference Time  : {pred['inference_timestamp']}")
    print(f"{'-'*60}")


def print_summary(predictions: list[dict]):
    """Print a batch summary table."""
    total = len(predictions)
    reorder_needed = sum(1 for p in predictions if p["reorder_recommended"])
    critical = sum(1 for p in predictions if p["risk_level"] == "CRITICAL")
    high = sum(1 for p in predictions if p["risk_level"] == "HIGH")
    total_value = sum(p["total_value"] for p in predictions)

    print(f"\n{'='*60}")
    print(f"  CutWise IMS - AI Inference Summary")
    print(f"  Run Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    print(f"  Total Materials Analyzed  : {total}")
    print(f"  [CRITICAL] Risk           : {critical}")
    print(f"  [HIGH]     Risk           : {high}")
    print(f"  Reorder Recommended       : {reorder_needed}")
    print(f"  Total Inventory Value     : PHP {total_value:,.2f}")
    print(f"{'='*60}")
    print(f"\n  {'#':<4} {'Material':<30} {'Risk':<10} {'Days':>6} {'Reorder':<10}")
    print(f"  {'-'*62}")
    for i, p in enumerate(predictions[:20], 1):
        reorder = "YES" if p["reorder_recommended"] else "-"
        days = f"{p['days_until_min_stock']:.0f}d" if p['days_until_min_stock'] < 999 else "Stable"
        print(f"  {i:<4} {p['material_name']:<30} {p['risk_level']:<10} {days:>6} {reorder:<10}")
    print(f"  {'-'*62}\n")


# ============================================================
# CLI ENTRY POINT
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        prog="inference",
        description=(
            "CutWise IMS — AI Stock Depletion Inference Script\n"
            "Capstone 2: Sprint 3 (WBS 4.3 - AI Recommendation Engine)\n\n"
            "Reads material data from the feature store (analytics.db)\n"
            "and runs Linear Regression + Risk Scoring to generate\n"
            "reorder recommendations for inventory management."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m apps.analytics.inference --all\n"
            "  python -m apps.analytics.inference --material \"Bonded Leather\"\n"
            "  python -m apps.analytics.inference --all --output data/predictions.json\n"
            "  python -m apps.analytics.inference --summary\n"
        ),
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--all", action="store_true",
        help="Run inference on all materials in the feature store.",
    )
    group.add_argument(
        "--material", type=str, metavar="NAME",
        help="Run inference for a specific material by name (case-insensitive).",
    )
    group.add_argument(
        "--summary", action="store_true",
        help="Print a compact summary table of all material predictions.",
    )

    parser.add_argument(
        "--output", type=str, metavar="FILE",
        help="Save predictions as JSON to the specified file path.",
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Print additional metadata in prediction output.",
    )
    parser.add_argument(
        "--critical-only", action="store_true",
        help="Only show CRITICAL and HIGH risk materials.",
    )

    args = parser.parse_args()

    # ── Validate DB ───────────────────────────────────────────
    if not SQLITE_PATH.exists():
        print(
            f"\n❌ Error: Analytics database not found at:\n   {SQLITE_PATH}\n\n"
            "   Run the data pipeline first:\n"
            "   cd backend && python -m apps.analytics.extract_data\n",
            file=sys.stderr,
        )
        return 1

    # ── Execute ───────────────────────────────────────────────
    predictions = []

    if args.all or args.summary:
        logger.info("Loading all materials from feature store...")
        predictions = batch_predict()
        logger.info(f"Inference complete — {len(predictions)} materials processed.")

        if args.critical_only:
            predictions = [p for p in predictions if p["risk_level"] in ("CRITICAL", "HIGH")]

        if args.summary:
            print_summary(predictions)
        else:
            print_summary(predictions)
            for pred in predictions:
                print_prediction(pred, verbose=args.verbose)

    elif args.material:
        pred = predict(args.material)
        if pred is None:
            print(f"\n❌ No material found matching: '{args.material}'\n", file=sys.stderr)
            return 1
        predictions = [pred]
        print_prediction(pred, verbose=args.verbose)

    # ── Save to JSON ──────────────────────────────────────────
    output_path = args.output
    if not output_path and (args.all or args.summary):
        output_path = str(DATA_DIR / "predictions_output.json")

    if output_path and predictions:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "model": "CutWise IMS — Linear Regression Stock Depletion Model",
                    "version": "1.0.0",
                    "run_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "source_db": str(SQLITE_PATH),
                    "total_materials": len(predictions),
                    "reorder_recommended": sum(1 for p in predictions if p["reorder_recommended"]),
                    "critical_count": sum(1 for p in predictions if p["risk_level"] == "CRITICAL"),
                    "predictions": predictions,
                },
                f,
                indent=2,
                default=str,
            )
        logger.info(f"[SAVED] Predictions saved to: {out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
