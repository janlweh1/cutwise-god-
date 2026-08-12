#!/usr/bin/env python
"""
================================================================
  CutWise IMS - Analytics Query Examples
  Capstone 2: Sprint 3 — Inventory & Scrap Analytics (WBS 4.1/4.2)

  Runs 5 complex analytical queries against the analytics.db
  columnar database (SQLite) to demonstrate:
    - Aggregations
    - Trend analysis
    - Multi-table joins
    - Risk rankings
    - Inventory value distribution

  Architecture Mapping:
    Analytics Engine -> Trend Analysis -> Inventory Insights
    Analytics Engine -> Stock Optimization -> Risk Reports

  Usage:
    cd backend
    python -m apps.analytics.analytics_queries
    python -m apps.analytics.analytics_queries --query 1
    python -m apps.analytics.analytics_queries --all --save
    python -m apps.analytics.analytics_queries --all --json

  Output:
    - Formatted tables to stdout
    - Optional: data/analytics_query_results.txt
    - Optional: data/analytics_query_results.json
================================================================
"""

import argparse
import json
import sqlite3
import sys
import logging
from datetime import datetime
from pathlib import Path

# ── Path setup ───────────────────────────────────────────────
BASE_DIR    = Path(__file__).resolve().parent.parent.parent
SQLITE_PATH = BASE_DIR / "data" / "analytics.db"
DATA_DIR    = BASE_DIR / "data"

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ============================================================
# ANALYTICS QUERIES
# ============================================================

QUERIES = {
    1: {
        "title":       "Query 1 — Stock Risk Aggregation by Material Type",
        "description": (
            "Groups all materials by type and computes aggregate risk metrics.\n"
            "Shows which material categories have the highest average risk score\n"
            "and the total inventory value at stake per category.\n"
            "TYPE: Aggregation | Tables: risk_scores"
        ),
        "sql": """
            SELECT
                material_type,
                COUNT(*)                                        AS total_materials,
                SUM(CASE WHEN at_risk = 1 THEN 1 ELSE 0 END)  AS at_risk_count,
                ROUND(AVG(risk_score), 4)                       AS avg_risk_score,
                MAX(risk_score)                                 AS max_risk_score,
                ROUND(AVG(quantity), 2)                         AS avg_quantity,
                SUM(quantity)                                   AS total_quantity,
                ROUND(SUM(total_value), 2)                     AS total_inventory_value,
                COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) AS critical_count,
                COUNT(CASE WHEN risk_level = 'HIGH'     THEN 1 END) AS high_count,
                COUNT(CASE WHEN risk_level = 'MEDIUM'   THEN 1 END) AS medium_count,
                COUNT(CASE WHEN risk_level = 'LOW'      THEN 1 END) AS low_count
            FROM risk_scores
            GROUP BY material_type
            ORDER BY avg_risk_score DESC
        """,
    },
    2: {
        "title":       "Query 2 — Reorder Priority Ranking with Depletion Forecast",
        "description": (
            "Joins predictions with risk scores to rank materials needing\n"
            "immediate reorder by urgency (days_until_min_stock ascending).\n"
            "Includes forecasted stock levels at 7, 14, and 30 days.\n"
            "TYPE: Multi-table JOIN + Trend Forecast | Tables: material_predictions, risk_scores"
        ),
        "sql": """
            SELECT
                ROW_NUMBER() OVER (ORDER BY mp.days_until_min_stock ASC) AS priority,
                mp.material_name,
                mp.material_type,
                mp.current_stock,
                mp.min_stock,
                mp.predicted_stock_7d,
                mp.predicted_stock_14d,
                mp.predicted_stock_30d,
                ROUND(mp.days_until_min_stock, 1)   AS days_until_min_stock,
                ROUND(mp.daily_consumption_rate, 4)  AS daily_rate,
                mp.estimated_depletion_date,
                rs.risk_level,
                ROUND(rs.risk_score, 4)              AS risk_score,
                mp.confidence,
                CASE WHEN mp.reorder_recommended = 1
                     THEN 'YES — ORDER NOW'
                     ELSE 'No'
                END                                  AS reorder_action
            FROM material_predictions mp
            JOIN risk_scores rs ON mp.material_id = rs.material_id
            WHERE mp.reorder_recommended = 1
            ORDER BY mp.days_until_min_stock ASC
        """,
    },
    3: {
        "title":       "Query 3 — Daily Activity Trend & Peak Usage Analysis",
        "description": (
            "Analyzes audit log activity over time to identify usage trends.\n"
            "Shows daily event counts, cumulative events, and 3-day rolling\n"
            "average to smooth out noise and reveal patterns.\n"
            "TYPE: Window Functions + Trend Analysis | Tables: daily_activity_trend, raw_audit_logs"
        ),
        "sql": """
            SELECT
                dat.date,
                dat.event_count,
                SUM(dat.event_count) OVER (
                    ORDER BY dat.date
                    ROWS UNBOUNDED PRECEDING
                )                                            AS cumulative_events,
                ROUND(AVG(CAST(dat.event_count AS FLOAT)) OVER (
                    ORDER BY dat.date
                    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
                ), 2)                                        AS rolling_avg_3d,
                CASE
                    WHEN dat.event_count >= (
                        SELECT AVG(event_count) * 1.5 FROM daily_activity_trend
                    ) THEN 'HIGH'
                    WHEN dat.event_count >= (
                        SELECT AVG(event_count) FROM daily_activity_trend
                    ) THEN 'NORMAL'
                    ELSE 'LOW'
                END                                          AS activity_level
            FROM daily_activity_trend dat
            ORDER BY dat.date DESC
            LIMIT 15
        """,
    },
    4: {
        "title":       "Query 4 — User Activity & Action Distribution Analysis",
        "description": (
            "Cross-analyzes user activity counts with action type distribution\n"
            "to show per-user contribution percentages and most common actions.\n"
            "TYPE: Aggregation + Percentage Calculation | Tables: user_activity, action_distribution"
        ),
        "sql": """
            SELECT
                ua.username,
                ua.total_actions,
                ROUND(
                    CAST(ua.total_actions AS FLOAT) /
                    (SELECT SUM(total_actions) FROM user_activity) * 100,
                    2
                )                                          AS activity_pct,
                ua.first_action,
                ua.last_action,
                (
                    SELECT action_type FROM action_distribution
                    ORDER BY count DESC LIMIT 1
                )                                          AS top_system_action,
                (
                    SELECT count FROM action_distribution
                    ORDER BY count DESC LIMIT 1
                )                                          AS top_action_count
            FROM user_activity ua
            ORDER BY ua.total_actions DESC
        """,
    },
    5: {
        "title":       "Query 5 — Inventory Value Distribution & Financial Risk Exposure",
        "description": (
            "Calculates total inventory value, financial risk exposure for at-risk\n"
            "materials, and potential loss if critical stock runs out.\n"
            "Segments materials into value tiers (High/Medium/Low value).\n"
            "TYPE: Financial Aggregation + CASE segmentation | Tables: risk_scores"
        ),
        "sql": """
            SELECT
                CASE
                    WHEN total_value >= 20000 THEN 'High Value (>= PHP 20,000)'
                    WHEN total_value >= 5000  THEN 'Medium Value (PHP 5,000-19,999)'
                    ELSE                           'Low Value (< PHP 5,000)'
                END                                     AS value_tier,
                COUNT(*)                                AS material_count,
                ROUND(SUM(total_value), 2)              AS total_value_php,
                ROUND(AVG(total_value), 2)              AS avg_value_php,
                SUM(CASE WHEN at_risk = 1 THEN 1 ELSE 0 END) AS at_risk_count,
                ROUND(
                    SUM(CASE WHEN at_risk = 1 THEN total_value ELSE 0 END), 2
                )                                       AS value_at_risk_php,
                COUNT(CASE WHEN risk_level = 'CRITICAL' THEN 1 END) AS critical_count,
                ROUND(AVG(risk_score), 4)               AS avg_risk_score
            FROM risk_scores
            GROUP BY value_tier
            ORDER BY total_value_php DESC
        """,
    },
}


# ============================================================
# DB CONNECTION
# ============================================================

def connect_db() -> sqlite3.Connection:
    """Open a read-only connection to analytics.db."""
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(
            f"analytics.db not found at {SQLITE_PATH}.\n"
            "Run extract_data.py first to generate the analytics database."
        )
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def run_query(query_id: int) -> tuple[list[dict], list[str]]:
    """Execute a query and return (rows, column_names)."""
    q = QUERIES[query_id]
    conn = connect_db()
    try:
        cursor = conn.execute(q["sql"])
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(r) for r in cursor.fetchall()]
        return rows, columns
    finally:
        conn.close()


# ============================================================
# DISPLAY
# ============================================================

def format_value(val) -> str:
    """Format a cell value for display."""
    if val is None:
        return "NULL"
    if isinstance(val, float):
        if val > 1000:
            return f"{val:,.2f}"
        return f"{val:.4f}"
    if isinstance(val, bool):
        return "YES" if val else "No"
    return str(val)


def print_table(rows: list[dict], columns: list[str], max_col_width: int = 22):
    """Print query results as a formatted ASCII table."""
    if not rows:
        print("  (no results)\n")
        return

    # Calculate column widths
    widths = {col: min(max(len(col), max(len(format_value(r[col])) for r in rows)), max_col_width)
              for col in columns}

    sep = "+" + "+".join("-" * (w + 2) for w in widths.values()) + "+"
    header = "|" + "|".join(f" {col[:widths[col]]:<{widths[col]}} " for col in columns) + "|"

    print(sep)
    print(header)
    print(sep)
    for row in rows:
        line = "|"
        for col in columns:
            val = format_value(row[col])
            val = val[:widths[col]]
            line += f" {val:<{widths[col]}} |"
        print(line)
    print(sep)
    print(f"  {len(rows)} row(s) returned\n")


def print_query_block(query_id: int, rows: list[dict], columns: list[str]):
    """Print query header + results."""
    q = QUERIES[query_id]
    print(f"\n{'='*70}")
    print(f"  {q['title']}")
    print(f"{'='*70}")
    print(f"\n  {q['description']}\n")
    print(f"  SQL:\n")
    for line in q["sql"].strip().splitlines():
        print(f"    {line}")
    print(f"\n  Results:\n")
    print_table(rows, columns)


# ============================================================
# SAVE OUTPUT
# ============================================================

def save_text_output(results: dict[int, tuple[list[dict], list[str]]]):
    """Save all query results to a text file."""
    out_path = DATA_DIR / "analytics_query_results.txt"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("CutWise IMS — Analytics Query Examples\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Database : {SQLITE_PATH}\n")
        f.write("=" * 70 + "\n\n")

        for qid, (rows, cols) in results.items():
            q = QUERIES[qid]
            f.write(f"\n{'='*70}\n")
            f.write(f"  {q['title']}\n")
            f.write(f"{'='*70}\n\n")
            f.write(f"  {q['description']}\n\n")
            f.write(f"  SQL:\n{q['sql']}\n\n")
            f.write(f"  Results ({len(rows)} rows):\n\n")

            if rows and cols:
                widths = {c: max(len(c), max(len(str(r.get(c, ""))) for r in rows))
                          for c in cols}
                widths = {c: min(w, 25) for c, w in widths.items()}
                sep = "+" + "+".join("-" * (w + 2) for w in widths.values()) + "+"
                header = "|" + "|".join(
                    f" {c[:widths[c]]:<{widths[c]}} " for c in cols
                ) + "|"
                f.write(sep + "\n" + header + "\n" + sep + "\n")
                for row in rows:
                    line = "|"
                    for c in cols:
                        val = str(row.get(c, ""))[:widths[c]]
                        line += f" {val:<{widths[c]}} |"
                    f.write(line + "\n")
                f.write(sep + "\n")
            else:
                f.write("  (no results)\n")
            f.write("\n")

    logger.info(f"[SAVED] Text output saved to: {out_path}")
    return out_path


def save_json_output(results: dict[int, tuple[list[dict], list[str]]]):
    """Save all query results to a JSON file."""
    out_path = DATA_DIR / "analytics_query_results.json"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "database": str(SQLITE_PATH),
        "queries": {},
    }
    for qid, (rows, cols) in results.items():
        q = QUERIES[qid]
        payload["queries"][str(qid)] = {
            "title":       q["title"],
            "description": q["description"],
            "sql":         q["sql"].strip(),
            "row_count":   len(rows),
            "columns":     cols,
            "results":     rows,
        }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, default=str)

    logger.info(f"[SAVED] JSON output saved to: {out_path}")
    return out_path


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        prog="analytics_queries",
        description=(
            "CutWise IMS — Complex Analytics Query Examples\n"
            "Capstone 2: Sprint 3 (WBS 4.1/4.2 - Inventory & Scrap Analytics)\n\n"
            "Runs analytical SQL queries against the analytics.db\n"
            "columnar database to demonstrate trend analysis,\n"
            "aggregations, and inventory risk insights."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m apps.analytics.analytics_queries --all\n"
            "  python -m apps.analytics.analytics_queries --query 2\n"
            "  python -m apps.analytics.analytics_queries --all --save\n"
            "  python -m apps.analytics.analytics_queries --all --json\n"
        ),
    )

    parser.add_argument(
        "--all", action="store_true",
        help="Run all 5 analytical queries.",
    )
    parser.add_argument(
        "--query", type=int, choices=[1, 2, 3, 4, 5], metavar="N",
        help="Run a specific query by number (1–5).",
    )
    parser.add_argument(
        "--save", action="store_true",
        help="Save output to data/analytics_query_results.txt",
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Save output to data/analytics_query_results.json",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List available queries without running them.",
    )

    args = parser.parse_args()

    if args.list:
        print("\nAvailable Queries:\n")
        for qid, q in QUERIES.items():
            print(f"  [{qid}] {q['title']}")
        print()
        return 0

    if not args.all and not args.query:
        parser.print_help()
        print("\n  Tip: Run with --all to execute all queries.\n")
        return 0

    # ── Validate DB ───────────────────────────────────────────
    if not SQLITE_PATH.exists():
        print(
            f"\n[ERROR] analytics.db not found at:\n   {SQLITE_PATH}\n\n"
            "   Run the data pipeline first:\n"
            "   cd backend && python -m apps.analytics.extract_data\n",
            file=sys.stderr,
        )
        return 1

    print(f"\n{'='*70}")
    print(f"  CutWise IMS — Analytics Query Examples")
    print(f"  Capstone 2: Sprint 3 — WBS 4.1 / 4.2")
    print(f"  Database : {SQLITE_PATH}")
    print(f"  Run Date : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")

    query_ids = list(QUERIES.keys()) if args.all else [args.query]
    collected_results: dict[int, tuple[list[dict], list[str]]] = {}

    for qid in query_ids:
        try:
            rows, cols = run_query(qid)
            collected_results[qid] = (rows, cols)
            print_query_block(qid, rows, cols)
        except Exception as e:
            logger.error(f"Query {qid} failed: {e}")
            collected_results[qid] = ([], [])

    # ── Save outputs ──────────────────────────────────────────
    if args.save:
        save_text_output(collected_results)

    if args.json:
        save_json_output(collected_results)

    # ── Always save when running all queries ──────────────────
    if args.all:
        save_text_output(collected_results)
        save_json_output(collected_results)

    print(f"\n{'='*70}")
    print(f"  [DONE] Completed {len(query_ids)} quer{'y' if len(query_ids)==1 else 'ies'}.")
    print(f"{'='*70}\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
