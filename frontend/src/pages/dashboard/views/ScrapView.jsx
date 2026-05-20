import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

const MATERIAL_TYPES = [
  { value: "cowhide", label: "Cowhide" },
  { value: "goatskin", label: "Goatskin" },
  { value: "sheepskin", label: "Sheepskin" },
  { value: "suede", label: "Suede" },
  { value: "nappa", label: "Nappa Leather" },
  { value: "synthetic", label: "Synthetic Leather" },
  { value: "rubber", label: "Rubber" },
  { value: "other", label: "Other" },
];

const SCRAP_RATES = {
  cowhide: 50,
  goatskin: 45,
  sheepskin: 40,
  suede: 35,
  nappa: 55,
  synthetic: 20,
  rubber: 15,
  other: 25,
};

const emptyForm = {
  source_batch: "",
  material_type: "cowhide",
  weight_kg: "",
  source: "conversion",
  notes: "",
};

export const ScrapView = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await api.get("/inventory/scrap/");
      setRecords(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch scrap records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const computedValue = () => {
    const weight = parseFloat(form.weight_kg) || 0;
    const rate = SCRAP_RATES[form.material_type] || 25;
    return (weight * rate).toFixed(2);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const validate = () => {
    const errs = {};
    if (!form.weight_kg || Number(form.weight_kg) <= 0) errs.weight_kg = "Weight must be greater than 0.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post("/inventory/scrap/", {
        source_batch: form.source_batch.trim(),
        material_type: form.material_type,
        weight_kg: Number(form.weight_kg),
        source: form.source,
        notes: form.notes.trim(),
      });
      showNotif("Scrap recorded successfully.");
      setShowModal(false);
      setForm(emptyForm);
      fetchRecords();
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const fieldErrs = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
        setErrors(fieldErrs);
      } else {
        showNotif("Failed to save scrap record.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Summary stats ─────────────────────────── */
  const totalWeight = records.reduce((sum, r) => sum + Number(r.weight_kg), 0);
  const totalValue = records.reduce((sum, r) => sum + Number(r.value), 0);

  return (
    <div className="view-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      <div className="view-header">
        <h2 className="view-title">Scrap Management</h2>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setForm(emptyForm); setErrors({}); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Convert Scrap
        </button>
      </div>

      {/* Summary Cards */}
      <div className="scrap-summary">
        <div className="scrap-summary-card">
          <span className="scrap-summary-label">Total Scrap Weight</span>
          <span className="scrap-summary-value">{totalWeight.toFixed(2)} kg</span>
        </div>
        <div className="scrap-summary-card">
          <span className="scrap-summary-label">Total Scrap Value</span>
          <span className="scrap-summary-value">₱{totalValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="scrap-summary-card">
          <span className="scrap-summary-label">Total Records</span>
          <span className="scrap-summary-value">{records.length}</span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="view-loading">Loading scrap records...</div>
      ) : records.length === 0 ? (
        <div className="view-empty">No scrap records found. Convert your first scrap above.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source Batch</th>
                <th>Material Type</th>
                <th>Weight (kg)</th>
                <th>Value (₱)</th>
                <th>Source</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.source_batch || "—"}</td>
                  <td>{r.material_type_display}</td>
                  <td>{Number(r.weight_kg).toFixed(3)}</td>
                  <td>₱{Number(r.value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td><span className={`source-badge source-${r.source}`}>{r.source_display}</span></td>
                  <td>{new Date(r.created_at).toLocaleDateString("en-PH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Convert Scrap Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Convert Scrap</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Source Batch</label>
                <input name="source_batch" value={form.source_batch} onChange={handleChange} placeholder="e.g., BATCH-2026-05-001" />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Material Type *</label>
                  <select name="material_type" value={form.material_type} onChange={handleChange}>
                    {MATERIAL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Weight (kg) *</label>
                  <input name="weight_kg" type="number" step="0.001" min="0.001" value={form.weight_kg} onChange={handleChange} placeholder="0.000" />
                  {errors.weight_kg && <span className="form-error">{errors.weight_kg}</span>}
                </div>
              </div>

              {/* Live value preview */}
              <div className="scrap-value-preview">
                <span>Estimated Value:</span>
                <strong>₱{computedValue()}</strong>
                <small>(Rate: ₱{SCRAP_RATES[form.material_type] || 25}/kg)</small>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows="3" placeholder="Optional notes..." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Converting..." : "Convert Scrap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrapView;
