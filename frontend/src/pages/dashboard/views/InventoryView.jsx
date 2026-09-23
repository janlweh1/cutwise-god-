import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

/* ── Status badge helper ─────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    in_stock: { label: "In Stock", className: "badge-success" },
    low_stock: { label: "Low Stock", className: "badge-warning" },
    out_of_stock: { label: "Out of Stock", className: "badge-danger" },
  };
  const info = map[status] || map.in_stock;
  return <span className={`status-badge ${info.className}`}>{info.label}</span>;
};

/* ── Material type options ───────────────────── */
const MATERIAL_TYPES = [
  { value: "cowhide", label: "Cowhide" },
  { value: "goatskin", label: "Goatskin" },
  { value: "sheepskin", label: "Sheepskin" },
  { value: "suede", label: "Suede" },
  { value: "nappa", label: "Nappa Leather" },
  { value: "synthetic", label: "Synthetic Leather" },
  { value: "custom", label: "Custom" },
];

/* ── Empty form state ────────────────────────── */
const emptyForm = {
  material_name: "",
  material_type: "cowhide",
  custom_type: "",
  size_val: "",
  size_unit: "sqft",
  quantity: "",
  unit_cost: "",
  supplier: "",
};

export const InventoryView = () => {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingMat, setEditingMat] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  /* ── Pagination state ────────────────────────── */
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 30;

  /* ── Material No. generator ──────────────────── */
  const getMaterialNo = (index) => `MAT-${String((page - 1) * PAGE_SIZE + index + 1).padStart(3, "0")}`;

  /* ── Fetch data ─────────────────────────── */
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page };
      if (search) params.search = search;
      if (statusFilter) params.stock_status = statusFilter;
      if (typeFilter) params.material_type = typeFilter;  // server-side filter — keeps count accurate
      const res = await api.get("/inventory/materials/", { params });
      const data = res.data;
      if (data.results !== undefined) {
        setMaterials(data.results);
        setTotalCount(data.count || 0);
      } else {
        setMaterials(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      console.error("Failed to fetch materials:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, page]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.get("/inventory/suppliers/");
      setSuppliers(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    }
  }, []);

  /* Reset to page 1 whenever filters change */
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, [fetchMaterials, fetchSuppliers]);

  // No client-side type filter needed — the server handles it now

  /* ── Notification ────────────────────────────── */
  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  /* ── Modal helpers ───────────────────────────── */
  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (mat) => {
    const match = mat.size ? mat.size.match(/^([\d.]+)\s*(.*)$/) : null;
    const size_val = match ? match[1] : (mat.size || "");
    const size_unit = match && match[2].trim() ? match[2].trim() : "sqft";

    const knownType = MATERIAL_TYPES.find((t) => t.value === mat.material_type);
    const isCustom = !knownType || mat.material_type === "custom";

    setForm({
      material_name: mat.material_name,
      material_type: isCustom ? "custom" : mat.material_type,
      custom_type: isCustom ? mat.material_type : "",
      size_val: size_val,
      size_unit: size_unit,
      quantity: String(mat.quantity),
      unit_cost: String(mat.unit_cost),
      supplier: mat.supplier || "",
    });
    setEditingId(mat.id);
    setEditingMat(mat);
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setEditingMat(null);
    setForm(emptyForm);
    setErrors({});
  };

  /* ── Form change ─────────────────────────────── */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  /* ── Validate ────────────────────────────────── */
  const validate = () => {
    const errs = {};
    if (!form.material_name.trim()) errs.material_name = "Material name is required.";
    if (!form.size_val && form.size_val !== 0)  errs.size_val = "Size is required.";
    else if (Number(form.size_val) < 0)          errs.size_val = "Size cannot be negative.";
    if (!form.quantity || Number(form.quantity) < 0) errs.quantity = "Valid quantity is required.";
    if (!form.unit_cost || Number(form.unit_cost) < 0) errs.unit_cost = "Valid unit cost is required.";
    if (!form.supplier) errs.supplier = "Supplier is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ── Submit ──────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        material_name: form.material_name.trim(),
        material_type: form.material_type === "custom"
          ? (form.custom_type.trim() || "other")
          : form.material_type,
        size: form.size_val ? `${String(form.size_val).trim()} ${form.size_unit}` : "",
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
        supplier: form.supplier || null,
      };
      if (editingId) {
        await api.patch(`/inventory/materials/${editingId}/`, payload);
        showNotif("Material updated successfully.");
      } else {
        await api.post("/inventory/materials/", payload);
        showNotif("Material added successfully.");
      }
      closeModal();
      fetchMaterials();
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === "object" && !Array.isArray(data)) {
        // Map field errors
        const fieldErrs = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
        setErrors(fieldErrs);
      } else {
        showNotif(data?.detail || "Failed to save material.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete Material ─────────────────────────── */
  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await api.delete(`/inventory/materials/${id}/`);
        showNotif(`Material "${name}" deleted successfully.`);
        fetchMaterials();
      } catch (err) {
        console.error("Failed to delete material:", err);
        const detail = err.response?.data?.detail || "Failed to delete material.";
        showNotif(detail, "error");
      }
    }
  };

  /* ── Render ──────────────────────────────────── */
  return (
    <div className="view-container">
      {/* Notification */}
      {notification && (
        <div className={`notif notif-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header Row */}
      <div className="view-header">
        <h2 className="view-title">Inventory Management</h2>
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Material
        </button>
      </div>

      {/* Filters */}
      <div className="view-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search by name or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {MATERIAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="view-loading">Loading materials...</div>
      ) : materials.length === 0 ? (
        <div className="view-empty">No materials found. Add your first material above.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material No.</th>
                <th>Material Name</th>
                <th>Type</th>
                <th>Size</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat, idx) => (
                <tr key={mat.id} className={mat.stock_status === "low_stock" ? "row-warning" : mat.stock_status === "out_of_stock" ? "row-danger" : ""}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {mat.material_no || getMaterialNo(idx)}
                  </td>
                  <td className="td-bold">{mat.material_name}</td>
                  <td>{MATERIAL_TYPES.find((t) => t.value === mat.material_type)?.label || mat.material_type}</td>
                  <td>{mat.size || "—"}</td>
                  <td>{mat.quantity}</td>
                  <td>₱{Number(mat.unit_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td>{mat.supplier_name || "—"}</td>
                  <td><StatusBadge status={mat.stock_status} /></td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEditModal(mat)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => handleDelete(mat.id, mat.material_name)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalCount > PAGE_SIZE && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          background: "#fff",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
          >
            Previous
          </button>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
            Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
            <span style={{ marginLeft: "0.5rem", fontWeight: 400 }}>({totalCount} total)</span>
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * PAGE_SIZE >= totalCount}
            style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? "Edit Material" : "Add New Material"}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {errors.non_field_errors && <div className="form-error-box">{errors.non_field_errors}</div>}

              {/* Material No. — read-only display */}
              <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "4px", display: "block" }}>Material No.</label>
                <div style={{
                  padding: "0.45rem 0.75rem",
                  background: "#F3F4F6",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                }}>
                  {editingId && editingMat
                    ? (editingMat.material_no || getMaterialNo(materials.findIndex(m => m.id === editingId)))
                    : "Will be assigned automatically"}
                </div>
              </div>

              <div className="form-group">
                <label>Material Name *</label>
                <input name="material_name" value={form.material_name} onChange={handleChange} placeholder="e.g., Full Grain Cowhide" />
                {errors.material_name && <span className="form-error">{errors.material_name}</span>}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Type *</label>
                  <select name="material_type" value={form.material_type} onChange={handleChange}>
                    {MATERIAL_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {form.material_type === "custom" && (
                    <input
                      name="custom_type"
                      value={form.custom_type}
                      onChange={handleChange}
                      placeholder="Enter custom type..."
                      style={{ marginTop: "6px" }}
                    />
                  )}
                </div>
                <div className="form-group">
                  <label>Size *</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      name="size_val"
                      type="number"
                      step="any"
                      min="0"
                      value={form.size_val}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "-" && e.preventDefault()}
                      placeholder="e.g., 12"
                      style={{ flex: 1, borderColor: errors.size_val ? "#EF4444" : undefined }}
                    />
                    <select
                      name="size_unit"
                      value={form.size_unit}
                      onChange={handleChange}
                      style={{ width: "100px" }}
                    >
                      <option value="sqft">sqft</option>
                      <option value="sqm">sqm</option>
                      <option value="meters">meters</option>
                      <option value="rolls">rolls</option>
                      <option value="ml">ml</option>
                      <option value="liters">liters</option>
                    </select>
                  </div>
                  {errors.size_val && <span className="form-error">{errors.size_val}</span>}
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input name="quantity" type="number" min="0" value={form.quantity} onChange={handleChange} />
                  {errors.quantity && <span className="form-error">{errors.quantity}</span>}
                </div>
                <div className="form-group">
                  <label>Unit Cost (₱) *</label>
                  <input name="unit_cost" type="number" min="0" step="0.01" value={form.unit_cost} onChange={handleChange} />
                  {errors.unit_cost && <span className="form-error">{errors.unit_cost}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Supplier *</label>
                <select name="supplier" value={form.supplier} onChange={handleChange}>
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.supplier && <span className="form-error">{errors.supplier}</span>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
