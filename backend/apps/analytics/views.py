"""
================================================================
  CutWise IMS - Analytics API Views
  Capstone 2: Serves analytics.db data to the frontend.
================================================================
"""

import sqlite3
from pathlib import Path

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

# Path to the SQLite analytics database
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SQLITE_PATH = BASE_DIR / "data" / "analytics.db"


def query_sqlite(sql, params=()):
    """Helper: run a SELECT on analytics.db and return rows as list of dicts."""
    if not SQLITE_PATH.exists():
        return None  # DB not generated yet
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.execute(sql, params)
        rows = [dict(row) for row in cursor.fetchall()]
        return rows
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()


def _check(rows):
    """Return a DRF Response for None/error results, or None if rows are valid."""
    if rows is None:
        return Response(
            {"error": "Analytics database not found. Run extract_data.py first."},
            status=status.HTTP_404_NOT_FOUND,
        )
    if isinstance(rows, dict) and "error" in rows:
        return Response(rows, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return None


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_summary(request):
    """GET /api/v1/analytics/summary/ — Latest KPI summary."""
    rows = query_sqlite("SELECT * FROM summary_reports ORDER BY run_date DESC LIMIT 1")
    err = _check(rows)
    if err:
        return err
    return Response(rows[0] if rows else {})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_risk_scores(request):
    """GET /api/v1/analytics/risk-scores/ — Per-material risk scores."""
    rows = query_sqlite("SELECT * FROM risk_scores ORDER BY risk_score DESC")
    err = _check(rows)
    if err:
        return err
    return Response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_predictions(request):
    """GET /api/v1/analytics/predictions/ — AI stock depletion predictions."""
    rows = query_sqlite(
        "SELECT * FROM material_predictions ORDER BY days_until_min_stock ASC"
    )
    err = _check(rows)
    if err:
        return err
    return Response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_user_activity(request):
    """GET /api/v1/analytics/user-activity/ — Per-user action counts."""
    rows = query_sqlite("SELECT * FROM user_activity ORDER BY total_actions DESC")
    err = _check(rows)
    if err:
        return err
    return Response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_action_distribution(request):
    """GET /api/v1/analytics/action-distribution/ — Action type breakdown."""
    rows = query_sqlite("SELECT * FROM action_distribution ORDER BY count DESC")
    err = _check(rows)
    if err:
        return err
    return Response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_daily_trend(request):
    """GET /api/v1/analytics/daily-trend/ — Daily event count trend."""
    rows = query_sqlite("SELECT * FROM daily_activity_trend ORDER BY date ASC")
    err = _check(rows)
    if err:
        return err
    return Response(rows)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_extraction_log(request):
    """GET /api/v1/analytics/extraction-log/ — Recent pipeline run history."""
    rows = query_sqlite("SELECT * FROM extraction_log ORDER BY run_date DESC LIMIT 10")
    err = _check(rows)
    if err:
        return err
    return Response(rows)
