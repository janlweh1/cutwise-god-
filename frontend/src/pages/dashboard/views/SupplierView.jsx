import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

const emptyForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
};

/* ── Icon helpers ────────────────────────────── */
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/* ══════════════════════════════════════════════ */

export const SupplierView = () => {
  const [suppliers, setSuppliers]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState(null);   // supplier being edited
  const [deleteTarget, setDeleteTarget] = useState(null);   // supplier pending delete confirm
  const [form, setForm]                 = useState(emptyForm);
  const [errors, setErrors]             = useState({});
  const [submitting, setSubmitting]     = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [notification, setNotification] = useState(null);

  /* ── Fetch ───────────────────────────────────── */
  const fetchSuppliers = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const res = await api.get("/inventory/suppliers/", { params });
      setSuppliers(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  /* ── Notifications ───────────────────────────── */
  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  /* ── Modal helpers ───────────────────────────── */
  const openAddModal = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (supplier) => {
    setEditTarget(supplier);
    setForm({
      name:           supplier.name,
      contact_person: supplier.contact_person || "",
      phone:          supplier.phone || "",
      email:          supplier.email || "",
      address:        supplier.address || "",
    });
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditTarget(null);
  };

  /* ── Form handling ───────────────────────────── */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Supplier name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      name:           form.name.trim(),
      contact_person: form.contact_person.trim(),
      phone:          form.phone.trim(),
      email:          form.email.trim(),
      address:        form.address.trim(),
    };
    try {
      if (editTarget) {
        await api.put(`/inventory/suppliers/${editTarget.id}/`, payload);
        showNotif("Supplier updated successfully.");
      } else {
        await api.post("/inventory/suppliers/", payload);
        showNotif("Supplier added successfully.");
      }
      closeModal();
      fetchSuppliers();
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const fieldErrs = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
        setErrors(fieldErrs);
      } else {
        showNotif(editTarget ? "Failed to update supplier." : "Failed to add supplier.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete handling ─────────────────────────── */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/suppliers/${deleteTarget.id}/`);
      showNotif(`Supplier "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetchSuppliers();
    } catch {
      showNotif("Failed to delete supplier. It may have associated materials.", "error");
    } finally {
      setDeleting(false);
    }
  };

  /* ─────────────────────────────────────────────── */
  return (
    <div className="view-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      {/* Header */}
      <div className="view-header">
        <h2 className="view-title">Supplier Reference</h2>
        <button id="add-supplier-btn" className="btn btn-primary" onClick={openAddModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Supplier
        </button>
      </div>

      {/* Search */}
      <div className="view-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="view-loading">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="view-empty">No suppliers found. Add your first supplier above.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" id="supplier-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Materials</th>
                <th style={{ width: "90px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="td-bold">{s.name}</td>
                  <td>{s.contact_person || "—"}</td>
                  <td>{s.phone || "—"}</td>
                  <td>{s.email || "—"}</td>
                  <td>
                    <span className="material-count-badge">
                      {s.material_count} material{s.material_count !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                      <button
                        className="btn-icon"
                        title="Edit supplier"
                        id={`edit-supplier-${s.id}`}
                        onClick={() => openEditModal(s)}
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        title="Delete supplier"
                        id={`delete-supplier-${s.id}`}
                        onClick={() => setDeleteTarget(s)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editTarget ? "Edit Supplier" : "Add Supplier"}</h3>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Supplier Name *</label>
                <input
                  name="name"
                  id="supplier-name-input"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g., Manila Leather Supply"
                />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Contact Person</label>
                  <input name="contact_person" value={form.contact_person} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+63..." />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} rows="2" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" id="supplier-submit-btn" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editTarget ? "Save Changes" : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Supplier</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>&times;</button>
            </div>
            <div className="modal-form">
              <div style={{
                display: "flex", gap: "1rem", alignItems: "flex-start",
                padding: "0.5rem 0", color: "var(--text-dark)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>
                    Are you sure you want to delete <em>{deleteTarget.name}</em>?
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    This action cannot be undone. If this supplier has associated materials, the deletion may fail.
                  </p>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button
                  id="confirm-delete-supplier-btn"
                  className="btn btn-primary"
                  style={{ background: "#DC2626" }}
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierView;
