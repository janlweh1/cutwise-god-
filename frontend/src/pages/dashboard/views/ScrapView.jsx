import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";
import trackerApi from "../../../lib/trackerApi";
import QrExpandModal from "../../../components/QrExpandModal";

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
    claimed:   { label: "Claimed",   color: "#6D28D9", bg: "#EDE9FE" },
    sold:      { label: "Sold",      color: "#4B5563", bg: "#F3F4F6" },
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

/* ── QR Tag & Physical Profile Modal ─────────── */

const QrTagModal = ({ scrap, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    storage_bin: "BIN-01",
    length_cm: "",
    width_cm: "",
    grade: "grade_b",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedQr, setExpandedQr] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await trackerApi.getProfile(scrap.id);
        setProfile(data);
        setForm({
          storage_bin: data.storage_bin || "BIN-01",
          length_cm: data.length_cm != null ? String(data.length_cm) : "",
          width_cm: data.width_cm != null ? String(data.width_cm) : "",
          grade: data.grade || "grade_b",
        });
      } catch (err) {
        // Not found is normal for fresh scrap records; we initialize form defaults
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [scrap.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        scrap_id: scrap.id,
        storage_bin: form.storage_bin.trim() || "UNASSIGNED",
        grade: form.grade,
        length_cm: form.length_cm ? Number(form.length_cm) : null,
        width_cm: form.width_cm ? Number(form.width_cm) : null,
      };
      const res = await trackerApi.createOrUpdateProfile(payload);
      setProfile(res);
      onSuccess("Physical profile & QR tag updated.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!profile?.qr_token) return;
    const url = trackerApi.getThermalLabelUrl(profile.qr_token);
    window.open(url, "_blank", "width=520,height=380,menubar=no,toolbar=no,location=no,status=no");
  };

  const estArea = form.length_cm && form.width_cm ? (Number(form.length_cm) * Number(form.width_cm)).toFixed(1) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>Physical QR Tag & Geometry</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "var(--text-muted)" }}>
            Loading physical profile…
          </div>
        ) : (
          <form onSubmit={handleSave} className="modal-form" style={{ paddingTop: "1.25rem" }}>
            <div style={{
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              background: "var(--bg-cream)",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}>
              <span>Asset:</span>
              <strong style={{ color: "var(--text-dark)" }}>{scrap.material_name}</strong>
              <span>&bull;</span>
              <span>{Number(scrap.weight_kg).toFixed(3)} kg</span>
            </div>

            {error && (
              <div style={{ padding: "0.6rem 0.85rem", background: "#FEE2E2", color: "#991B1B", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.82rem" }}>
                {error}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="form-group">
                <label>Storage Bin Coordinate *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BIN-A04"
                  value={form.storage_bin}
                  onChange={(e) => setForm({ ...form, storage_bin: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Leather Quality Grade *</label>
                <select
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                >
                  <option value="grade_a">Grade A (Upper Panels)</option>
                  <option value="grade_b">Grade B (Linings / Straps)</option>
                  <option value="grade_c">Grade C (Trimmings / Fillers)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="form-group">
                <label>Usable Length (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 35.0"
                  value={form.length_cm}
                  onChange={(e) => setForm({ ...form, length_cm: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Usable Width (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 20.0"
                  value={form.width_cm}
                  onChange={(e) => setForm({ ...form, width_cm: e.target.value })}
                />
              </div>
            </div>

            {estArea && (
              <div style={{ fontSize: "0.8rem", color: "#065F46", background: "#ECFDF5", padding: "6px 10px", borderRadius: "6px", marginBottom: "0.75rem" }}>
                Computed Usable Surface Area: <strong>{estArea} cm²</strong>
              </div>
            )}

            {/* QR Preview & Deep Link - Clickable to Expand */}
            {profile?.qr_token && (
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  background: "var(--bg-cream)",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  marginBottom: "1rem",
                  border: "1.5px solid var(--border-color)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => setExpandedQr(true)}
                title="Click to expand QR code into high-res scannable view"
              >
                <div style={{ position: "relative" }}>
                  <img
                    src={trackerApi.getQrImageUrl(profile.qr_token, 160)}
                    alt="QR Tag Preview"
                    style={{
                      width: 82,
                      height: 82,
                      borderRadius: "8px",
                      background: "#fff",
                      border: "1px solid var(--border-color)",
                      display: "block",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 4,
                      right: 4,
                      background: "rgba(0,0,0,0.75)",
                      color: "#fff",
                      borderRadius: "4px",
                      padding: "2px 4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span style={{ fontWeight: 800, color: "var(--text-dark)" }}>Scannable QR Tag</span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        background: "var(--primary)",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Click to Expand
                    </span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", wordBreak: "break-all" }}>
                    {window.location.origin}/scan/{profile.qr_token}
                  </div>
                  <div style={{ marginTop: "4px", color: "var(--primary)", fontWeight: 700 }}>
                    Bin: {profile.storage_bin} &bull; {profile.grade?.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {expandedQr && profile?.qr_token && (
              <QrExpandModal
                token={profile.qr_token}
                scrapName={scrap.material_name}
                bin={profile.storage_bin}
                grade={profile.grade}
                weightKg={scrap.weight_kg}
                dimensions={form.length_cm && form.width_cm ? `${form.length_cm} × ${form.width_cm} cm` : null}
                onClose={() => setExpandedQr(false)}
              />
            )}

            <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {profile?.qr_token && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePrint}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1F2937", color: "#fff" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print Sticker (50×30mm)
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : profile?.qr_token ? "Update Profile" : "Generate QR Tag"}
                </button>
              </div>
            </div>
          </form>
        )}
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
  const [qrTarget, setQrTarget] = useState(null); // scrap object for QR tag modal
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
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="btn btn-outline"
                          style={{
                            padding: "4px 10px",
                            fontSize: "0.78rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            border: "1px solid var(--border-color)",
                            background: "#fff",
                            color: "var(--text-dark)",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                          onClick={() => setQrTarget(s)}
                          id={`qr-btn-${s.id}`}
                          title="Print QR Tag & Physical Specs"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                          </svg>
                          QR Tag
                        </button>
                        {s.status === "available" && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "4px 12px", fontSize: "0.78rem" }}
                            onClick={() => setSellTarget(s)}
                            id={`sell-btn-${s.id}`}
                          >
                            Sell
                          </button>
                        )}
                      </div>
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
      {qrTarget && (
        <QrTagModal
          scrap={qrTarget}
          onClose={() => setQrTarget(null)}
          onSuccess={(msg) => {
            showNotif(msg);
            fetchAll();
          }}
        />
      )}
    </div>
  );
};

export default ScrapView;
