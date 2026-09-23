import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";
import { StatCard, StatCards } from "../../../components/dashboard/StatCard";

/* ── Helpers ─────────────────────────────────── */

const fmt = (n, dec = 2) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

const fmtDate = (str) =>
  new Date(str).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ── Add Stock Modal ─────────────────────────── */

const AddStockModal = ({ scrapType, onClose, onSuccess }) => {
  const [kg, setKg] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentKg = Number(scrapType.available_kg) || 0;
  const addedKg = parseFloat(kg) || 0;
  const newTotal = currentKg + addedKg;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!kg || addedKg <= 0) {
      setError("Please enter a valid weight greater than 0 kg.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/inventory/scrap-types/${scrapType.id}/add_stock/`, { kg: addedKg });
      onSuccess(`Successfully added ${fmt(addedKg, 3)} kg to "${scrapType.name}".`);
    } catch (err) {
      const data = err.response?.data;
      setError(
        (data && (data.error || data.detail)) ||
          "Failed to add scrap stock. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addPreset = (amount) => {
    const cur = parseFloat(kg) || 0;
    setKg((cur + amount).toFixed(amount < 1 ? 2 : 1));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Add Production Scrap</h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Log incoming off-cuts and trimmings from workshop operations
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Current info card */}
        <div style={{
          padding: "1.25rem 1.5rem 0.5rem",
        }}>
          <div style={{
            background: "var(--bg-cream)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "0.85rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Target Scrap Grade
              </div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-dark)", marginTop: "2px" }}>
                {scrapType.name}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Current Stock
              </div>
              <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--text-dark)", marginTop: "2px" }}>
                {currentKg.toFixed(3)} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>kg</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" style={{ paddingTop: "0.75rem" }}>
          {error && (
            <div className="form-error-box">
              {error}
            </div>
          )}

          <div className="form-group">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Weight to Add (kg) *</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal" }}>
                Accurate to 3 decimal places
              </span>
            </label>
            <input
              id="add-stock-kg-input"
              type="number"
              step="0.001"
              min="0.001"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="0.000"
              autoFocus
              style={{ fontSize: "1.1rem", padding: "0.65rem 0.85rem" }}
            />

            {/* Quick Presets */}
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, marginRight: "0.2rem" }}>
                Quick:
              </span>
              {[0.5, 1, 2, 5, 10].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => addPreset(preset)}
                  style={{
                    padding: "0.25rem 0.55rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    background: "#ffffff",
                    color: "var(--text-dark)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.color = "var(--primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.color = "var(--text-dark)";
                  }}
                >
                  +{preset} kg
                </button>
              ))}
              {kg && (
                <button
                  type="button"
                  onClick={() => setKg("")}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "6px",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* New total summary preview */}
          {addedKg > 0 && (
            <div style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: "0.72rem", color: "#065F46", textTransform: "uppercase", fontWeight: 700 }}>
                  Projected Stock Balance
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  {currentKg.toFixed(3)} kg + {addedKg.toFixed(3)} kg
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "#059669" }}>
                {newTotal.toFixed(3)} <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>kg</span>
              </div>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="add-stock-submit"
            >
              {submitting ? "Saving…" : "Confirm Add Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Sell Scrap Modal ────────────────────────── */

const SellScrapModal = ({ scrapType, onClose, onSuccess }) => {
  const [kgToSell, setKgToSell] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const maxKg = Number(scrapType.available_kg) || 0;
  const qty = parseFloat(kgToSell) || 0;
  const pricePerKg = Number(scrapType.price_per_kg) || 0;
  const estimatedTotal = qty * pricePerKg;

  const validate = () => {
    const errs = {};
    if (!kgToSell || qty <= 0) {
      errs.kg = "Weight must be greater than 0 kg.";
    } else if (qty > maxKg) {
      errs.kg = `Cannot exceed available stock of ${maxKg.toFixed(3)} kg.`;
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/inventory/scrap-sales/", {
        scrap_type: scrapType.id,
        quantity_sold: qty,
      });
      onSuccess(`Sold ${fmt(qty, 3)} kg of "${scrapType.name}" for ₱${fmt(estimatedTotal)}.`);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const fieldErrs = {};
        for (const [k, v] of Object.entries(data)) {
          fieldErrs[k] = Array.isArray(v) ? v.join(" ") : String(v);
        }
        setErrors(fieldErrs);
      } else {
        setErrors({ non_field: "Failed to process sale. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Record Scrap Sale</h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Process scrap material sale to registered external buyers
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Current info card */}
        <div style={{ padding: "1.25rem 1.5rem 0.5rem" }}>
          <div style={{
            background: "var(--bg-cream)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "0.85rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Material Grade
              </div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-dark)", marginTop: "2px" }}>
                {scrapType.name}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Available to Sell
              </div>
              <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--text-dark)", marginTop: "2px" }}>
                {maxKg.toFixed(3)} <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>kg</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" style={{ paddingTop: "0.75rem" }}>
          {errors.non_field && (
            <div className="form-error-box">
              {errors.non_field}
            </div>
          )}

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label style={{ margin: 0 }}>Weight to Sell (kg) *</label>
              <button
                type="button"
                onClick={() => setKgToSell(String(maxKg))}
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border-color)",
                  background: "#ffffff",
                  color: "var(--primary)",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Sell All ({maxKg.toFixed(3)} kg)
              </button>
            </div>
            <input
              id="sell-weight-input"
              type="number"
              step="0.001"
              min="0.001"
              max={maxKg}
              value={kgToSell}
              onChange={(e) => setKgToSell(e.target.value)}
              placeholder="0.000"
              autoFocus
              style={{ fontSize: "1.1rem", padding: "0.65rem 0.85rem" }}
            />
            {errors.kg && <span className="form-error">{errors.kg}</span>}
            {errors.quantity_sold && <span className="form-error">{errors.quantity_sold}</span>}
          </div>

          {/* Pricing breakdown card */}
          <div style={{
            background: "#FAFAFA",
            border: "1px solid #F0F0F0",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Fixed Selling Rate:
            </span>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-dark)" }}>
              ₱{fmt(pricePerKg)} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>/ kg</span>
            </span>
          </div>

          {/* Live total estimation */}
          {qty > 0 && (
            <div style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              padding: "0.85rem 1rem",
              marginTop: "0.25rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#065F46", textTransform: "uppercase" }}>
                  Total Sale Proceeds
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {fmt(qty, 3)} kg × ₱{fmt(pricePerKg)}/kg
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: "1.45rem", color: "#059669", marginTop: "2px" }}>
                ₱{fmt(estimatedTotal)}
              </div>
              {maxKg - qty >= 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Remaining inventory after sale: <strong>{(maxKg - qty).toFixed(3)} kg</strong>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || maxKg === 0}
              id="sell-scrap-submit"
            >
              {submitting ? "Processing…" : "Confirm Sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   ScrapView — Main Component
   ══════════════════════════════════════════════ */

export const ScrapView = () => {
  const [scrapTypes, setScrapTypes] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory");
  const [addStockTarget, setAddStockTarget] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);
  const [notification, setNotification] = useState(null);

  /* ── Fetch ───────────────────────────────────── */

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rTypes, rSales] = await Promise.all([
        api.get("/inventory/scrap-types/"),
        api.get("/inventory/scrap-sales/"),
      ]);
      setScrapTypes(rTypes.data.results || rTypes.data);
      setSales(rSales.data.results || rSales.data);
    } catch (err) {
      console.error("Failed to load scrap data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Notifications ───────────────────────────── */

  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  /* ── Modal handlers ──────────────────────────── */

  const handleAddStockSuccess = (msg) => {
    setAddStockTarget(null);
    showNotif(msg);
    fetchAll();
  };

  const handleSellSuccess = (msg) => {
    setSellTarget(null);
    showNotif(msg);
    fetchAll();
  };

  /* ── Computed stats ──────────────────────────── */

  const totalAvailableKg = scrapTypes.reduce((s, t) => s + Number(t.available_kg || 0), 0);
  const totalSoldKg = sales.reduce((s, t) => s + Number(t.quantity_sold || 0), 0);
  const totalRevenue = sales.reduce((s, t) => s + Number(t.total_amount || 0), 0);

  return (
    <div className="view-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      {/* Header */}
      <div className="view-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 className="view-title">Scrap Management</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Monitor cutting room waste, log yields from production, and manage wholesale scrap sales.
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <StatCards>
        <StatCard
          label="Total Available"
          value={`${totalAvailableKg.toFixed(3)} kg`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
          sub={`Across ${scrapTypes.length} scrap grade${scrapTypes.length !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total Sold"
          value={`${totalSoldKg.toFixed(3)} kg`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          }
          sub={`${sales.length} transaction${sales.length !== 1 ? "s" : ""} recorded`}
        />
        <StatCard
          label="Total Scrap Revenue"
          value={`₱${fmt(totalRevenue)}`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          sub="All-time scrap proceeds"
        />
      </StatCards>

      {/* Tab Navigation */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        marginBottom: "1.5rem",
        borderBottom: "2px solid var(--border-color)",
      }}>
        {[
          { id: "inventory", label: "Scrap Inventory", count: scrapTypes.length },
          { id: "sales", label: "Sales History", count: sales.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`scrap-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.65rem 1.15rem",
                border: "none",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--primary)" : "var(--text-muted)",
                fontSize: "0.875rem",
                marginBottom: "-2px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.1rem 0.5rem",
                borderRadius: "9999px",
                background: isActive ? "var(--primary-light)" : "#E5E7EB",
                color: isActive ? "var(--primary)" : "var(--text-muted)",
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="view-loading">Loading scrap inventory…</div>
      ) : activeTab === "inventory" ? (
        /* ── Scrap Type Cards ── */
        <div className="scrap-types-grid">
          {scrapTypes.length === 0 ? (
            <div className="view-empty" style={{ gridColumn: "1 / -1" }}>
              No scrap types configured.
            </div>
          ) : (
            scrapTypes.map((st) => {
              const available = Number(st.available_kg) || 0;
              const price = Number(st.price_per_kg) || 0;
              const isLow = available <= 2 && available > 0;
              const isEmpty = available === 0;
              const isHighGrade =
                st.name.toLowerCase().includes("high") || price >= 100;
              const assetVal = available * price;

              // Progress relative to standard 15kg healthy volume
              const fillPct = Math.min(100, Math.max(5, (available / 15) * 100));

              return (
                <div
                  key={st.id}
                  id={`scrap-type-card-${st.id}`}
                  className="scrap-card"
                >
                  {/* Card Header */}
                  <div className="scrap-card-header">
                    <div className="scrap-card-top-row">
                      <span className={`scrap-grade-badge ${isHighGrade ? "premium" : "standard"}`}>
                        {isHighGrade ? "★ Premium Grade" : "Standard Grade"}
                      </span>
                      <span className={`scrap-status-pill ${isEmpty ? "out-of-stock" : isLow ? "low-stock" : "in-stock"}`}>
                        {isEmpty ? "● Out of Stock" : isLow ? "● Low Stock" : "● In Stock"}
                      </span>
                    </div>

                    <h3 className="scrap-card-title">{st.name}</h3>
                    <p className="scrap-card-desc">
                      {isHighGrade
                        ? "Selected large cutaways & clean leather trimmings"
                        : "Assorted off-cuts, edge shavings & secondary scrap"}
                    </p>

                    {/* Official Rate Banner */}
                    <div className="scrap-price-banner">
                      <span className="scrap-price-label">Wholesale Rate</span>
                      <div>
                        <span className="scrap-price-amount">₱{fmt(price)}</span>
                        <span className="scrap-price-unit">/ kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="scrap-card-body">
                    {/* Stock Overview Box */}
                    <div className="scrap-stock-box">
                      <div className="scrap-stock-box-header">
                        <span className="scrap-stock-box-label">Available Stock</span>
                        <span className="scrap-stock-box-value">
                          ₱{fmt(assetVal)} est.
                        </span>
                      </div>

                      <div
                        className="scrap-stock-number"
                        style={{
                          color: isEmpty ? "#DC2626" : isLow ? "#D97706" : "var(--text-dark)",
                        }}
                      >
                        {available.toFixed(3)}
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: "4px" }}>
                          kg
                        </span>
                      </div>

                      {/* Stock health visual bar */}
                      <div className="scrap-progress-track">
                        <div
                          className="scrap-progress-fill"
                          style={{
                            width: `${fillPct}%`,
                            background: isEmpty
                              ? "#DC2626"
                              : isLow
                              ? "#D97706"
                              : "#059669",
                          }}
                        />
                      </div>

                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "0.45rem",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}>
                        <span>
                          {isEmpty
                            ? "Empty • Log stock to enable sales"
                            : isLow
                            ? "Running low on scrap stock"
                            : "Available for scrap sale"}
                        </span>
                        <span>{available > 0 ? "Stored at Cutting" : "Needs Yield"}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="scrap-card-actions">
                      <button
                        type="button"
                        className="scrap-btn-add"
                        onClick={() => setAddStockTarget(st)}
                        id={`add-stock-btn-${st.id}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Stock
                      </button>

                      <button
                        type="button"
                        className="scrap-btn-sell"
                        disabled={isEmpty}
                        onClick={() => !isEmpty && setSellTarget(st)}
                        id={`sell-btn-${st.id}`}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="9" cy="21" r="1" />
                          <circle cx="20" cy="21" r="1" />
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                        Sell Scrap
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── Sales History Tab ── */
        sales.length === 0 ? (
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "3.5rem 2rem",
            textAlign: "center",
            boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--bg-cream)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h4 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-dark)", marginBottom: "0.35rem" }}>
              No Scrap Sales Recorded Yet
            </h4>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto" }}>
              When scrap material is sold to external buyers, transactions with weights, unit rates, and total revenues will be documented here.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table" id="scrap-sales-table">
              <thead>
                <tr>
                  <th>Scrap Grade</th>
                  <th>Quantity Sold</th>
                  <th>Unit Rate</th>
                  <th>Total Amount</th>
                  <th>Recorded By</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const isHigh = s.scrap_type_name?.toLowerCase().includes("high");
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: isHigh ? "#D97706" : "var(--primary)",
                          }} />
                          <span style={{ fontWeight: 600, color: "var(--text-dark)" }}>
                            {s.scrap_type_name}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: "var(--font-heading)" }}>
                        {Number(s.quantity_sold).toFixed(3)} kg
                      </td>
                      <td style={{ color: "var(--text-muted)" }}>
                        ₱{fmt(s.sale_price_per_kg)} / kg
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          fontFamily: "var(--font-heading)",
                          color: "#059669",
                          background: "#ECFDF5",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}>
                          ₱{fmt(s.total_amount)}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>
                        {s.sold_by_name || "—"}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>
                        {fmtDate(s.sale_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modals */}
      {addStockTarget && (
        <AddStockModal
          scrapType={addStockTarget}
          onClose={() => setAddStockTarget(null)}
          onSuccess={handleAddStockSuccess}
        />
      )}
      {sellTarget && (
        <SellScrapModal
          scrapType={sellTarget}
          onClose={() => setSellTarget(null)}
          onSuccess={handleSellSuccess}
        />
      )}
    </div>
  );
};

export default ScrapView;
