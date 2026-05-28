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
  { value: "rubber", label: "Rubber" },
  { value: "thread", label: "Thread" },
  { value: "adhesive", label: "Adhesive" },
  { value: "accessory", label: "Accessory" },
  { value: "other", label: "Other" },
];

/* ── Empty form state ────────────────────────── */
const emptyForm = {
  material_name: "",
  material_type: "other",
  size_val: "",
  size_unit: "sqft",
  quantity: "",
  unit_cost: "",
  supplier: "",
  min_stock: "10",
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
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  /* ── Fetch data ──────────────────────────────── */
  const fetchMaterials = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.stock_status = statusFilter;
      const res = await api.get("/inventory/materials/", { params });
      setMaterials(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch materials:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await api.get("/inventory/suppliers/");
      setSuppliers(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, [fetchMaterials, fetchSuppliers]);

  /* ── Filter by type locally ──────────────────── */
  const displayed = typeFilter
    ? materials.filter((m) => m.material_type === typeFilter)
    : materials;

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

    setForm({
      material_name: mat.material_name,
      material_type: mat.material_type,
      size_val: size_val,
      size_unit: size_unit,
      quantity: String(mat.quantity),
      unit_cost: String(mat.unit_cost),
      supplier: mat.supplier || "",
      min_stock: String(mat.min_stock),
    });
    setEditingId(mat.id);
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
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
        material_type: form.material_type,
        size: form.size_val ? `${String(form.size_val).trim()} ${form.size_unit}` : "",
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
        supplier: form.supplier || null,
        min_stock: Number(form.min_stock) || 10,
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
      ) : displayed.length === 0 ? (
        <div className="view-empty">No materials found. Add your first material above.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
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
              {displayed.map((mat) => (
                <tr key={mat.id} className={mat.stock_status === "low_stock" ? "row-warning" : mat.stock_status === "out_of_stock" ? "row-danger" : ""}>
                  <td className="td-bold">{mat.material_name}</td>
                  <td>{MATERIAL_TYPES.find((t) => t.value === mat.material_type)?.label || mat.material_type}</td>
                  <td>{mat.size || "—"}</td>
                  <td>{mat.quantity}</td>
                  <td>₱{Number(mat.unit_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td>{mat.supplier_name || "—"}</td>
                  <td><StatusBadge status={mat.stock_status} /></td>
                  <td>
                    <button className="btn-icon" title="Edit" onClick={() => openEditModal(mat)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                </div>
                <div className="form-group">
                  <label>Size</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      name="size_val"
                      type="number"
                      step="any"
                      min="0"
                      value={form.size_val}
                      onChange={handleChange}
                      placeholder="e.g., 12"
                      style={{ flex: 1 }}
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

              <div className="form-row-2">
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
                <div className="form-group">
                  <label>Reorder Level</label>
                  <input name="min_stock" type="number" min="0" value={form.min_stock} onChange={handleChange} />
                </div>
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
