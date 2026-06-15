import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

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
  });

/* ── Status Badge ────────────────────────────── */

const StatusBadge = ({ status }) => {
  const config = {
    available: { label: "Available", color: "#059669", bg: "#D1FAE5" },
    sold:      { label: "Sold",      color: "#7B1F1F", bg: "#FEE2E2" },
  };
  const c = config[status] || { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.03em",
      color: c.color,
      background: c.bg,
    }}>
      {c.label}
    </span>
  );
};

/* ── Record Scrap Modal ──────────────────────── */

const RecordScrapModal = ({ materials, onClose, onSuccess }) => {
  const [form, setForm] = useState({ material: "", weight_kg: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.material) errs.material = "Please select a source material.";
    if (!form.weight_kg || Number(form.weight_kg) <= 0)
      errs.weight_kg = "Weight must be greater than 0.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post("/inventory/scrap/", {
        material: form.material,
        weight_kg: Number(form.weight_kg),
      });
      onSuccess("Scrap recorded successfully.");
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const fieldErrs = {};
        for (const [k, v] of Object.entries(data)) {
          fieldErrs[k] = Array.isArray(v) ? v.join(" ") : String(v);
        }
        setErrors(fieldErrs);
      } else {
        setErrors({ non_field: "Failed to record scrap. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Record Scrap</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {errors.non_field && (
            <div style={{ color: "var(--text-red)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {errors.non_field}
            </div>
          )}

          <div className="form-group">
            <label>Source Material *</label>
            <select
              id="scrap-material-select"
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
            >
              <option value="">— Select material —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.material_name} ({m.material_type}) — {m.quantity} in stock
                </option>
              ))}
            </select>
            {errors.material && <span className="form-error">{errors.material}</span>}
          </div>

          <div className="form-group">
            <label>Weight (kg) *</label>
            <input
              id="scrap-weight-input"
              type="number"
              step="0.001"
              min="0.001"
              value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
              placeholder="0.000"
            />
            {errors.weight_kg && <span className="form-error">{errors.weight_kg}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting} id="record-scrap-submit">
              {submitting ? "Recording…" : "Record Scrap"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Sell Scrap Modal ────────────────────────── */

const SellScrapModal = ({ scrap, onClose, onSuccess }) => {
  const [form, setForm] = useState({ quantity_sold: "", sale_price_per_kg: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const maxWeight = Number(scrap.weight_kg);
  const weight = parseFloat(form.quantity_sold) || 0;
  const price = parseFloat(form.sale_price_per_kg) || 0;
  const estimatedTotal = weight * price;
  const unitCost = parseFloat(scrap.material_unit_cost || 0);
  const estimatedProfit = estimatedTotal - unitCost * weight;

  const validate = () => {
    const errs = {};
    if (!form.quantity_sold || weight <= 0)
      errs.quantity_sold = "Weight must be greater than 0.";
    else if (weight > maxWeight)
      errs.quantity_sold = `Cannot exceed available weight (${maxWeight.toFixed(3)} kg).`;
    if (!form.sale_price_per_kg || price <= 0)
      errs.sale_price_per_kg = "Price per kg must be greater than 0.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post("/inventory/scrap-sales/", {
        scrap: scrap.id,
        quantity_sold: Number(form.quantity_sold),
        sale_price_per_kg: Number(form.sale_price_per_kg),
      });
      onSuccess("Scrap sold successfully.");
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
          <h3>Sell Scrap</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Source info */}
        <div style={{
          background: "#F9FAFB",
          borderRadius: "8px",
          padding: "0.75rem 1rem",
          marginBottom: "1.25rem",
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}>
          <strong style={{ color: "var(--text-dark)" }}>{scrap.material_name}</strong>
          <br />
          Available: <strong>{Number(scrap.weight_kg).toFixed(3)} kg</strong>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {errors.non_field && (
            <div style={{ color: "var(--text-red)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {errors.non_field}
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label>Weight to Sell (kg) *</label>
              <input
                id="sell-weight-input"
                type="number"
                step="0.001"
                min="0.001"
                max={maxWeight}
                value={form.quantity_sold}
                onChange={(e) => setForm({ ...form, quantity_sold: e.target.value })}
                placeholder="0.000"
              />
              {errors.quantity_sold && <span className="form-error">{errors.quantity_sold}</span>}
            </div>

            <div className="form-group">
              <label>Price per kg (₱) *</label>
              <input
                id="sell-price-input"
                type="number"
                step="0.01"
                min="0.01"
                value={form.sale_price_per_kg}
                onChange={(e) => setForm({ ...form, sale_price_per_kg: e.target.value })}
                placeholder="0.00"
              />
              {errors.sale_price_per_kg && (
                <span className="form-error">{errors.sale_price_per_kg}</span>
              )}
            </div>
          </div>

          {/* Live preview */}
          {(weight > 0 || price > 0) && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.82rem",
            }}>
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: "2px" }}>Est. Total</div>
                <div style={{ fontWeight: 700, color: "#065F46", fontSize: "1rem" }}>
                  ₱{fmt(estimatedTotal)}
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: "2px" }}>Est. Profit</div>
                <div style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: estimatedProfit >= 0 ? "#065F46" : "#991B1B",
                }}>
                  {estimatedProfit >= 0 ? "+" : ""}₱{fmt(estimatedProfit)}
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting} id="sell-scrap-submit">
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
  const [scraps, setScraps] = useState([]);
  const [sales, setSales] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [sellTarget, setSellTarget] = useState(null); // scrap object to sell
  const [notification, setNotification] = useState(null);

  /* ── Fetch ───────────────────────────────────── */

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rScraps, rSales, rMaterials] = await Promise.all([
        api.get("/inventory/scrap/"),
        api.get("/inventory/scrap-sales/"),
        api.get("/inventory/materials/"),
      ]);
      setScraps(rScraps.data.results || rScraps.data);
      setSales(rSales.data.results || rSales.data);
      setMaterials(rMaterials.data.results || rMaterials.data);
    } catch (err) {
      console.error("Failed to load scrap data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Notifications ───────────────────────────── */

  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  /* ── Modal success handlers ──────────────────── */

  const handleRecordSuccess = (msg) => {
    setShowRecordModal(false);
    showNotif(msg);
    fetchAll();
  };

  const handleSellSuccess = (msg) => {
    setSellTarget(null);
    showNotif(msg);
    fetchAll();
  };

  /* ── Computed stats ──────────────────────────── */

  const availableScraps = scraps.filter((s) => s.status === "available");
  const totalAvailableKg = availableScraps.reduce((sum, s) => sum + Number(s.weight_kg), 0);
  const totalSoldKg = sales.reduce((sum, s) => sum + Number(s.quantity_sold), 0);
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);

  /* ── Enrich available scraps with unit_cost for sell modal preview ── */
  const enrichedScraps = scraps.map((s) => {
    const mat = materials.find((m) => m.id === s.material);
    return { ...s, material_unit_cost: mat?.unit_cost || 0 };
  });

  return (
    <div className="view-container">
      {/* Notification */}
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      {/* Header */}
      <div className="view-header">
        <h2 className="view-title">Scrap Management</h2>
        <button
          id="record-scrap-btn"
          className="btn btn-primary"
          onClick={() => setShowRecordModal(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Record Scrap
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="scrap-summary">
        <div className="scrap-summary-card">
          <span className="scrap-summary-label">Available Weight</span>
          <span className="scrap-summary-value">{totalAvailableKg.toFixed(3)} kg</span>
          <span className="scrap-summary-sub">{availableScraps.length} record{availableScraps.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="scrap-summary-card">
          <span className="scrap-summary-label">Total Sold</span>
          <span className="scrap-summary-value">{totalSoldKg.toFixed(3)} kg</span>
          <span className="scrap-summary-sub">{sales.length} transaction{sales.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="scrap-summary-card">
          <span className="scrap-summary-label">Total Revenue</span>
          <span className="scrap-summary-value">₱{fmt(totalRevenue)}</span>
          <span className="scrap-summary-sub">All-time scrap sales</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", borderBottom: "2px solid var(--border-color)" }}>
        {[
          { id: "inventory", label: "Scrap Inventory" },
          { id: "sales", label: "Sales History" },
        ].map((tab) => (
          <button
            key={tab.id}
            id={`scrap-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0.55rem 1.1rem",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
              fontSize: "0.875rem",
              marginBottom: "-2px",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="view-loading">Loading scrap data…</div>
      ) : activeTab === "inventory" ? (
        /* ── Scrap Inventory Tab ── */
        scraps.length === 0 ? (
          <div className="view-empty">No scrap records yet. Click "Record Scrap" to add one.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table" id="scrap-inventory-table">
              <thead>
                <tr>
                  <th>Source Material</th>
                  <th>Type</th>
                  <th>Weight (kg)</th>
                  <th>Date Recorded</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {enrichedScraps.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.material_name}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem", textTransform: "capitalize" }}>
                      {s.material_type || "—"}
                    </td>
                    <td>{Number(s.weight_kg).toFixed(3)}</td>
                    <td>{fmtDate(s.recorded_date)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {s.status === "available" ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: "4px 12px", fontSize: "0.78rem" }}
                          onClick={() => setSellTarget(s)}
                          id={`sell-btn-${s.id}`}
                        >
                          Sell
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Sales History Tab ── */
        sales.length === 0 ? (
          <div className="view-empty">No scrap sales recorded yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table" id="scrap-sales-table">
              <thead>
                <tr>
                  <th>Source Material</th>
                  <th>Weight Sold (kg)</th>
                  <th>Price / kg</th>
                  <th>Total Amount</th>
                  <th>Profit</th>
                  <th>Sold By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.scrap_material}</td>
                    <td>{Number(s.quantity_sold).toFixed(3)}</td>
                    <td>₱{fmt(s.sale_price_per_kg)}</td>
                    <td style={{ fontWeight: 600 }}>₱{fmt(s.total_amount)}</td>
                    <td style={{
                      fontWeight: 700,
                      color: Number(s.profit) >= 0 ? "#059669" : "#DC2626",
                    }}>
                      {Number(s.profit) >= 0 ? "+" : ""}₱{fmt(s.profit)}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      {s.sold_by_name || "—"}
                    </td>
                    <td>{fmtDate(s.sale_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modals */}
      {showRecordModal && (
        <RecordScrapModal
          materials={materials}
          onClose={() => setShowRecordModal(false)}
          onSuccess={handleRecordSuccess}
        />
      )}
      {sellTarget && (
        <SellScrapModal
          scrap={sellTarget}
          onClose={() => setSellTarget(null)}
          onSuccess={handleSellSuccess}
        />
      )}
    </div>
  );
};

export default ScrapView;
