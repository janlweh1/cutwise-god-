#!/usr/bin/env python
"""
================================================================
  CutWise IMS - Vector Database Population Script
  Capstone 2: Sprint 3 — AI Recommendation Engine (WBS 4.3)

  Generates semantic text embeddings from material data and
  stores them in a local ChromaDB vector database.

  This enables semantic similarity search — e.g.:
    "Find materials similar to Bonded Leather"
    "Which materials are out of stock?"
    "Show me synthetic leather with low supply"

  Architecture Mapping:
    Analytics Engine -> AI Recommendation -> Vector Search

  Technology:
    - Embeddings : sentence-transformers (all-MiniLM-L6-v2)
    - Vector DB  : ChromaDB (local persistent storage)
    - Data Source: analytics.db Feature Store (raw_materials table)

  Usage:
    cd backend
    python -m apps.analytics.vector_db                        # populate DB
    python -m apps.analytics.vector_db --query "out of stock leather"
    python -m apps.analytics.vector_db --query "synthetic low supply" --top 5
    python -m apps.analytics.vector_db --stats               # show DB stats

  Requirements:
    pip install chromadb sentence-transformers
================================================================
"""

import argparse
import json
import sqlite3
import sys
import logging
from datetime import datetime
from pathlib import Path

import numpy as np

# ── Path setup ───────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent.parent
SQLITE_PATH = BASE_DIR / "data" / "analytics.db"
CHROMA_DIR  = BASE_DIR / "data" / "chroma_db"
DATA_DIR    = BASE_DIR / "data"

COLLECTION_NAME = "cutwise_materials"

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ============================================================
# DEPENDENCY CHECK
# ============================================================

def check_dependencies():
    """Verify chromadb and sentence-transformers are installed."""
    missing = []
    try:
        import chromadb  # noqa: F401
    except ImportError:
        missing.append("chromadb")
    try:
        from sentence_transformers import SentenceTransformer  # noqa: F401
    except ImportError:
        missing.append("sentence-transformers")

    if missing:
        print(
            f"\n❌ Missing dependencies: {', '.join(missing)}\n"
            f"   Install with:\n"
            f"   pip install {' '.join(missing)}\n",
            file=sys.stderr,
        )
        sys.exit(1)


# ============================================================
# DATA LOADING
# ============================================================

def load_materials_from_db() -> list[dict]:
    """Load materials with risk scores from analytics.db."""
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(
            f"analytics.db not found at {SQLITE_PATH}.\n"
            "Run extract_data.py first."
        )

    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row

    # Join materials with risk scores for richer embeddings
    query = """
        SELECT
            rm.material_id,
            rm.material_name,
            rm.material_type,
            rm.supplier_name,
            rm.quantity,
            rm.min_stock,
            rm.unit_cost,
            rm.total_value,
            rm.stock_status,
            rm.size,
            rs.risk_score,
            rs.risk_level,
            rs.at_risk,
            rs.buffer_units,
            mp.predicted_stock_7d,
            mp.predicted_stock_14d,
            mp.reorder_recommended,
            mp.confidence,
            mp.days_until_min_stock
        FROM raw_materials rm
        LEFT JOIN risk_scores rs ON rm.material_id = rs.material_id
        LEFT JOIN material_predictions mp ON rm.material_id = mp.material_id
        ORDER BY rm.material_name
    """

    try:
        rows = conn.execute(query).fetchall()
        materials = [dict(r) for r in rows]
    except sqlite3.OperationalError:
        # Fallback: just raw materials if joins fail
        rows = conn.execute("SELECT * FROM raw_materials").fetchall()
        materials = [dict(r) for r in rows]
    finally:
        conn.close()

    logger.info(f"Loaded {len(materials)} materials from analytics.db")
    return materials


# ============================================================
# EMBEDDING DOCUMENT BUILDER
# ============================================================

def build_document(material: dict) -> str:
    """
    Build a rich text document for embedding from material data.

    The document concatenates key fields into a natural-language-like
    description that captures the semantic meaning of the material.
    This improves embedding quality for similarity search.

    Example output:
        "Bonded Leather (other leather) | Supplier: Global Leather Co |
         Stock: out_of_stock | Quantity: 0 units | Min Stock: 10 units |
         Unit Cost: PHP 450.00 | Risk Level: CRITICAL | At Risk: Yes |
         Reorder: YES | Days Until Reorder: 0.0 days"
    """
    name      = material.get("material_name", "Unknown")
    mat_type  = material.get("material_type", "unknown")
    supplier  = material.get("supplier_name", "Unknown")
    qty       = material.get("quantity", 0)
    min_stock = material.get("min_stock", 10)
    status    = material.get("stock_status", "unknown")
    cost      = material.get("unit_cost", 0)
    risk_lvl  = material.get("risk_level", "UNKNOWN")
    at_risk   = "Yes" if material.get("at_risk") else "No"
    reorder   = "YES" if material.get("reorder_recommended") else "No"
    days      = material.get("days_until_min_stock", 999)
    size      = material.get("size", "")
    pred_7d   = material.get("predicted_stock_7d", qty)
    buffer    = material.get("buffer_units", qty - min_stock)

    doc_parts = [
        f"{name} ({mat_type} leather)",
        f"Supplier: {supplier}",
        f"Stock: {status}",
        f"Quantity: {qty} units",
        f"Min Stock: {min_stock} units",
        f"Buffer: {buffer} units",
        f"Unit Cost: PHP {float(cost):,.2f}",
        f"Risk Level: {risk_lvl}",
        f"At Risk: {at_risk}",
        f"Reorder: {reorder}",
        f"Days Until Reorder: {days} days",
        f"Predicted 7-Day Stock: {pred_7d} units",
    ]
    if size:
        doc_parts.append(f"Size: {size}")

    return " | ".join(doc_parts)


# ============================================================
# VECTOR DB OPERATIONS
# ============================================================

def get_chroma_client():
    """Initialize persistent ChromaDB client."""
    import chromadb
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client


def get_or_create_collection(client):
    """Get or create the materials collection in ChromaDB."""
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={
            "description": "CutWise IMS material inventory embeddings",
            "model": "sentence-transformers/all-MiniLM-L6-v2",
            "created": datetime.now().isoformat(),
            "source": "analytics.db -> raw_materials + risk_scores + material_predictions",
        },
    )


def _load_embedding_model():
    """
    Load the sentence-transformers model, with offline TF-IDF fallback.
    Falls back to sklearn TF-IDF + TruncatedSVD if HuggingFace is unreachable.
    """
    try:
        from sentence_transformers import SentenceTransformer
        import socket
        # Quick connectivity check
        socket.setdefaulttimeout(3)
        socket.getaddrinfo("huggingface.co", 443)
        logger.info("  -> Network OK — loading sentence-transformers model")
        return SentenceTransformer("all-MiniLM-L6-v2"), "sentence-transformers"
    except Exception:
        logger.warning("  -> No internet — using offline TF-IDF + SVD embeddings (384-dim)")
        return None, "tfidf-svd"


def _encode_with_tfidf(documents: list[str]) -> "np.ndarray":
    """Offline fallback: TF-IDF + TruncatedSVD to produce 384-dim vectors."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.decomposition import TruncatedSVD
    from sklearn.preprocessing import normalize

    n_components = min(384, len(documents) - 1)
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=5000)
    tfidf_matrix = vectorizer.fit_transform(documents)
    svd = TruncatedSVD(n_components=n_components, random_state=42)
    reduced = svd.fit_transform(tfidf_matrix)

    # Pad to 384 dims if needed
    if reduced.shape[1] < 384:
        pad = np.zeros((reduced.shape[0], 384 - reduced.shape[1]))
        reduced = np.hstack([reduced, pad])

    return normalize(reduced, norm="l2").astype(np.float32)


def populate_vector_db(materials: list[dict]) -> int:
    """
    Generate embeddings for all materials and store in ChromaDB.
    """
    model, model_type = _load_embedding_model()

    # Build documents
    documents = [build_document(m) for m in materials]
    ids       = [m["material_id"] for m in materials]

    # Generate embeddings
    logger.info(f"Generating embeddings for {len(documents)} materials (model: {model_type})...")
    if model_type == "sentence-transformers":
        embeddings = model.encode(documents, show_progress_bar=False)
    else:
        embeddings = _encode_with_tfidf(documents)

    logger.info(f"  -> Generated {len(embeddings)} embeddings (dim={embeddings.shape[1]})")

    # Build metadata for each material
    metadatas = []
    for m in materials:
        metadatas.append({
            "material_name":   str(m.get("material_name", "")),
            "material_type":   str(m.get("material_type", "")),
            "supplier_name":   str(m.get("supplier_name", "")),
            "stock_status":    str(m.get("stock_status", "")),
            "quantity":        int(m.get("quantity", 0)),
            "min_stock":       int(m.get("min_stock", 0)),
            "unit_cost":       float(m.get("unit_cost", 0)),
            "total_value":     float(m.get("total_value", 0)),
            "risk_level":      str(m.get("risk_level", "UNKNOWN")),
            "at_risk":         bool(m.get("at_risk", False)),
            "reorder_recommended": bool(m.get("reorder_recommended", False)),
            "days_until_min_stock": float(m.get("days_until_min_stock") or 999),
        })

    # Store in ChromaDB
    logger.info("Storing embeddings in ChromaDB...")
    client = get_chroma_client()
    collection = get_or_create_collection(client)

    # Upsert (replace if already exists)
    collection.upsert(
        ids=ids,
        embeddings=embeddings.tolist(),
        documents=documents,
        metadatas=metadatas,
    )

    count = collection.count()
    logger.info(f"  -> ChromaDB collection '{COLLECTION_NAME}' now has {count} vectors")
    return count


# ============================================================
# SEMANTIC SEARCH
# ============================================================

def semantic_search(query: str, n_results: int = 5) -> list[dict]:
    """
    Perform semantic similarity search on the ChromaDB collection.

    Args:
        query     : Natural language query string
        n_results : Number of top results to return

    Returns:
        List of matching materials with similarity distances

    Example:
        >>> results = semantic_search("out of stock critical leather", n_results=3)
        >>> for r in results:
        ...     print(r["material_name"], r["risk_level"])
    """
    from sentence_transformers import SentenceTransformer

    logger.info(f"Running semantic search: \"{query}\"")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    client = get_chroma_client()

    try:
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        raise RuntimeError(
            f"Collection '{COLLECTION_NAME}' not found. "
            "Run vector_db.py without --query first to populate it."
        )

    query_embedding = model.encode([query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(n_results, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    output = []
    ids       = results["ids"][0]
    distances = results["distances"][0]
    metadatas = results["metadatas"][0]
    documents = results["documents"][0]

    for i, (rid, dist, meta, doc) in enumerate(
        zip(ids, distances, metadatas, documents)
    ):
        similarity = round(1 - dist, 4)  # Convert L2 distance to similarity
        output.append({
            "rank":            i + 1,
            "similarity":      similarity,
            "material_id":     rid,
            "material_name":   meta.get("material_name", ""),
            "material_type":   meta.get("material_type", ""),
            "supplier_name":   meta.get("supplier_name", ""),
            "stock_status":    meta.get("stock_status", ""),
            "quantity":        meta.get("quantity", 0),
            "risk_level":      meta.get("risk_level", ""),
            "reorder_recommended": meta.get("reorder_recommended", False),
            "document":        doc,
        })

    return output


def print_search_results(query: str, results: list[dict]):
    """Pretty-print semantic search results."""
    print(f"\n{'='*65}")
    print(f"  Semantic Search: \"{query}\"")
    print(f"  Top {len(results)} similar materials in Vector DB")
    print(f"{'='*65}")
    for r in results:
        reorder = "[REORDER]" if r["reorder_recommended"] else "[OK]"
        risk_icons = {"CRITICAL": "[CRIT]", "HIGH": "[HIGH]", "MEDIUM": "[MED]", "LOW": "[LOW]"}
        icon = risk_icons.get(r["risk_level"], "[?]")
        print(f"\n  #{r['rank']} | Similarity: {r['similarity']:.4f}")
        print(f"  {icon} {r['material_name']} ({r['material_type']})")
        print(f"     Supplier  : {r['supplier_name']}")
        print(f"     Stock     : {r['quantity']} units ({r['stock_status']})")
        print(f"     Risk      : {r['risk_level']}")
        print(f"     Status    : {reorder}")
    print(f"\n{'='*65}\n")


def print_db_stats():
    """Print statistics about the ChromaDB collection."""
    client = get_chroma_client()
    try:
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        print(
            f"\n[NOT FOUND] Collection '{COLLECTION_NAME}' not found.\n"
            "   Run: python -m apps.analytics.vector_db (without --query) to populate.\n"
        )
        return

    count = collection.count()
    meta  = collection.metadata or {}

    print(f"\n{'='*55}")
    print(f"  ChromaDB Collection Statistics")
    print(f"{'='*55}")
    print(f"  Collection Name  : {COLLECTION_NAME}")
    print(f"  Storage Path     : {CHROMA_DIR}")
    print(f"  Total Vectors    : {count}")
    print(f"  Embedding Model  : {meta.get('model', 'all-MiniLM-L6-v2')}")
    print(f"  Data Source      : {meta.get('source', 'analytics.db')}")
    print(f"  Created          : {meta.get('created', 'N/A')}")
    print(f"{'='*55}\n")


# ============================================================
# CLI ENTRY POINT
# ============================================================

def main():
    check_dependencies()

    parser = argparse.ArgumentParser(
        prog="vector_db",
        description=(
            "CutWise IMS — Vector DB Population & Semantic Search\n"
            "Capstone 2: Sprint 3 (WBS 4.3 - AI Recommendation Engine)\n\n"
            "Generates text embeddings from material inventory data\n"
            "and stores them in a ChromaDB vector database for\n"
            "semantic similarity search and AI-driven recommendations."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python -m apps.analytics.vector_db                      # Populate DB\n"
            "  python -m apps.analytics.vector_db --stats              # DB statistics\n"
            "  python -m apps.analytics.vector_db --query \"out of stock leather\"\n"
            "  python -m apps.analytics.vector_db --query \"critical synthetic\" --top 3\n"
        ),
    )

    parser.add_argument(
        "--query", type=str, metavar="TEXT",
        help="Run a semantic similarity search query against the Vector DB.",
    )
    parser.add_argument(
        "--top", type=int, default=5, metavar="N",
        help="Number of top results to return for --query (default: 5).",
    )
    parser.add_argument(
        "--stats", action="store_true",
        help="Print statistics about the current ChromaDB collection.",
    )
    parser.add_argument(
        "--repopulate", action="store_true",
        help="Force re-generation of all embeddings (replaces existing collection).",
    )

    args = parser.parse_args()

    # ── Stats only ────────────────────────────────────────────
    if args.stats:
        print_db_stats()
        return 0

    # ── Search only (if collection already exists) ─────────────
    if args.query and not args.repopulate:
        client = get_chroma_client()
        try:
            col = client.get_collection(COLLECTION_NAME)
            if col.count() > 0:
                results = semantic_search(args.query, n_results=args.top)
                print_search_results(args.query, results)
                return 0
        except Exception:
            pass
        # Fall through to populate first

    # ── Populate DB ───────────────────────────────────────────
    logger.info("=" * 55)
    logger.info("CutWise IMS — Vector DB Population")
    logger.info(f"Source  : {SQLITE_PATH}")
    logger.info(f"Storage : {CHROMA_DIR}")
    logger.info("=" * 55)

    materials = load_materials_from_db()

    if not materials:
        print("\n[ERROR] No materials found in analytics.db\n", file=sys.stderr)
        return 1

    count = populate_vector_db(materials)

    print(f"\n[OK] Vector DB populated successfully!")
    print(f"   Collection : {COLLECTION_NAME}")
    print(f"   Vectors    : {count}")
    print(f"   Storage    : {CHROMA_DIR}\n")

    # ── Run search if --query provided ────────────────────────
    if args.query:
        results = semantic_search(args.query, n_results=args.top)
        print_search_results(args.query, results)

    # ── Always run demo searches after population ──────────────
    else:
        print("Running demo semantic searches...\n")
        demo_queries = [
            "critical leather out of stock",
            "synthetic material low supply",
            "high value leather material",
        ]
        for q in demo_queries:
            results = semantic_search(q, n_results=3)
            print_search_results(q, results)

    return 0


if __name__ == "__main__":
    sys.exit(main())
