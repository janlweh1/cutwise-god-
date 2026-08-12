# CutWise IMS - Analytics & Data Pipeline Layer (Capstone 2)

This directory contains the Decoupled Analytics & Data Pipeline Layer for the CutWise Inventory Management System (IMS). 

## 🗺️ Architectural Alignment (Arch 1)

This module implements the core backend layers of the Capstone 2 conceptual architecture:
1. **Data Pipeline**: Contains ETL jobs, processes data aggregation, and manages the Feature Store.
2. **Analytics Engine**: Implements low-stock risk scoring, trend analysis, and demand forecasting.
3. **Decoupled Boundary**: Operates as a read-only client of the Capstone 1 PostgreSQL database, storing analytics results in a separate SQLite database.

```
PostgreSQL (Capstone 1) ----[read-only]----> extract_data.py ----[writes]----> SQLite (analytics.db)
     19 raw materials                          ETL & ML Predictions             Predictions, Risk tables
```

---

## 🛠️ Tech Stack & Requirements

- **Python**: 3.8+
- **Primary Database (Source)**: PostgreSQL (cutwise_db)
- **Analytics Database (Target)**: SQLite (analytics.db)
- **Machine Learning**: `scikit-learn` (Linear Regression)
- **Data Manipulation**: `pandas`, `numpy`

### Installation

Install the required analytical dependencies:

```bash
pip install pandas scikit-learn numpy
```

---

## 🚀 Usage

Run the data extraction and predictive analytics pipeline:

```bash
cd backend
python -m apps.analytics.extract_data
```

Upon execution, the script will:
1. Connect to the Capstone 1 PostgreSQL database.
2. Extract materials, suppliers, and audit logs.
3. Perform stock depletion forecasting using Linear Regression.
4. Calculate low-stock risk scoring based on inventory levels.
5. Generate an aggregated KPI summary report.
6. Write the results to `./data/analytics.db`.
7. Output a full data validation report to the console.

---

## 📊 Database Schema (SQLite Feature Store)

The generated SQLite database (`backend/data/analytics.db`) contains the following tables:

| Table Name | Data Type | Purpose |
|---|---|---|
| `raw_materials` | Relational (OLAP Mirror) | Copy of active materials from PostgreSQL |
| `raw_suppliers` | Relational (OLAP Mirror) | Copy of active suppliers from PostgreSQL |
| `raw_audit_logs` | Relational (OLAP Mirror) | Copy of audit log events from PostgreSQL |
| `risk_scores` | Analytical Results | Computed risk levels and buffer sizes for each material |
| `material_predictions` | Predictive Features | Linear Regression model outputs, depletion dates, and daily consumption rates |
| `user_activity` | Aggregated Analytics | User action counts and activity timelines |
| `action_distribution` | Aggregated Analytics | Event frequency breakdown by type |
| `daily_activity_trend` | Aggregated Analytics | Event counts grouped by calendar date |
| `summary_reports` | Aggregated KPIs | Executive dashboard indicators (value, stock levels) |
| `extraction_log` | Metadata | Pipeline run times, status, and record counts |

---

## 🧠 Predictive Methodology (Linear Regression)

The demand forecasting module uses a standard linear regression model:
- **Independent Variable (X)**: Time (days, projected 30 days out).
- **Dependent Variable (Y)**: Estimated future stock level.
- **Consumption Proxy**: Since the core database doesn't log daily stock deductions directly, the script calculates event frequency for stock modifications/updates as a proxy for consumption velocity.
- **Reorder Trigger**: Recommendations are raised if the model projects stock levels to fall below `min_stock` within 14 days.

---

## 🤖 Week 4 Deliverables (Sprint 3 — WBS 4.3)

### Deliverable 1: AI Model / Inference Script — `inference.py`

Standalone AI inference script. Takes material data from the feature store and returns structured stock depletion predictions.

**Model Pipeline:**
```
raw_materials + raw_audit_logs (analytics.db)
    │
    ├─> Consumption Rate Estimation (audit log frequency proxy)
    ├─> Linear Regression Forecasting (30-day projection)
    ├─> Risk Scoring (CRITICAL / HIGH / MEDIUM / LOW)
    │
    └─> JSON Output: predictions_output.json
```

**Usage:**
```bash
cd backend

# Run inference on all materials
python -m apps.analytics.inference --all

# Run for a specific material
python -m apps.analytics.inference --material "Bonded Leather"

# Show summary table
python -m apps.analytics.inference --summary

# Only show critical/high risk
python -m apps.analytics.inference --all --critical-only

# Save to custom path
python -m apps.analytics.inference --all --output data/my_predictions.json
```

**Output Format (JSON):**
```json
{
  "model": "CutWise IMS — Linear Regression Stock Depletion Model",
  "version": "1.0.0",
  "run_date": "2026-07-25 00:00:00",
  "total_materials": 19,
  "reorder_recommended": 15,
  "critical_count": 7,
  "predictions": [
    {
      "material_name": "Bonded Leather",
      "current_stock": 0,
      "min_stock": 10,
      "model_type": "LinearRegression",
      "daily_consumption_rate": 0.5,
      "predicted_stock_7d": 0,
      "predicted_stock_14d": 0,
      "predicted_stock_30d": 0,
      "days_until_min_stock": 0.0,
      "estimated_reorder_date": "2026-07-25",
      "reorder_recommended": true,
      "risk_score": 1.0,
      "risk_level": "CRITICAL",
      "confidence": "LOW"
    }
  ]
}
```

**Risk Score Formula:**
```
stock_ratio = quantity / max(min_stock, 1)
risk_score  = clamp(1 - (stock_ratio - 1) / 2,  0.0,  1.0)

CRITICAL  :  risk_score >= 0.80  →  Immediate reorder required
HIGH      :  risk_score >= 0.60  →  Order within 3 days
MEDIUM    :  risk_score >= 0.40  →  Monitor closely
LOW       :  risk_score <  0.40  →  Adequate stock
```

---

### Deliverable 2: Vector DB Population — `vector_db.py`

Generates semantic embeddings from material data and stores them in a **ChromaDB** local vector database for AI-powered similarity search.

**Technology:**
| Component | Tech |
|-----------|------|
| Embedding Model | `sentence-transformers/all-MiniLM-L6-v2` (384-dim) |
| Vector Database | ChromaDB (persistent local storage) |
| Storage Path | `backend/data/chroma_db/` |
| Collection Name | `cutwise_materials` |

**Install dependencies (first time only):**
```bash
pip install chromadb sentence-transformers
```

**Usage:**
```bash
cd backend

# Populate the Vector DB (generates embeddings for all 19 materials)
python -m apps.analytics.vector_db

# Run a semantic similarity search
python -m apps.analytics.vector_db --query "out of stock critical leather"
python -m apps.analytics.vector_db --query "synthetic material low supply" --top 3

# Show DB statistics
python -m apps.analytics.vector_db --stats
```

**Embedding Document Format:**
Each material is embedded as a rich natural-language text:
```
"{material_name} ({material_type} leather) | Supplier: {supplier_name} |
 Stock: {stock_status} | Quantity: {qty} units | Min Stock: {min_stock} units |
 Risk Level: {risk_level} | Reorder: {YES/No} | Days Until Reorder: {n} days"
```

---

### Deliverable 3: Analytics Query Examples — `analytics_queries.py`

Runs 5 complex analytical SQL queries against `analytics.db` covering aggregations, window functions, joins, and financial risk analysis.

| # | Query Title | Type |
|---|-------------|------|
| 1 | Stock Risk Aggregation by Material Type | GROUP BY + aggregation |
| 2 | Reorder Priority Ranking with Depletion Forecast | JOIN + ordering |
| 3 | Daily Activity Trend & Peak Usage Analysis | Window functions |
| 4 | User Activity & Action Distribution Analysis | Cross aggregation |
| 5 | Inventory Value Distribution & Financial Risk | CASE segmentation |

**Usage:**
```bash
cd backend

# Run all 5 queries (auto-saves results to data/)
python -m apps.analytics.analytics_queries --all

# Run specific query
python -m apps.analytics.analytics_queries --query 2

# Save as JSON
python -m apps.analytics.analytics_queries --all --json
```

**Output files:**
- `backend/data/analytics_query_results.txt` — formatted ASCII tables
- `backend/data/analytics_query_results.json` — structured JSON

---

## 📦 Full Requirements

```
# Core (already in requirements.txt)
pandas>=2.0,<3.0
scikit-learn>=1.4,<2.0
numpy>=1.26,<3.0

# New for Week 4 Vector DB (install separately)
chromadb>=0.4,<1.0
sentence-transformers>=2.7,<3.0
```

## 📊 System Data Summary (as of July 25, 2026)

| Metric | Value |
|--------|-------|
| Total Materials | 19 |
| Total Inventory Value | PHP 265,400.00 |
| CRITICAL Risk Materials | 7 (36.8%) |
| Reorder Recommended | 15 (78.9%) |
| Audit Events | 2,232 |
| Embedding Vectors | 19 (384-dim each) |
| Model | Linear Regression (scikit-learn) |
| Embedding Model | all-MiniLM-L6-v2 |
| Vector DB | ChromaDB (local persistent) |
