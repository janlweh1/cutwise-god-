import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

const emptyForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
};

export const SupplierView = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

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

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const showNotif = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

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
    try {
      await api.post("/inventory/suppliers/", {
        name: form.name.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      });
      showNotif("Supplier added successfully.");
      setShowModal(false);
      setForm(emptyForm);
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
        showNotif("Failed to add supplier.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="view-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      <div className="view-header">
        <h2 className="view-title">Supplier Reference</h2>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setForm(emptyForm); setErrors({}); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Supplier
        </button>
      </div>

      <div className="view-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="view-loading">Loading suppliers...</div>
      ) : suppliers.length === 0 ? (
        <div className="view-empty">No suppliers found. Add your first supplier above.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Materials</th>
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
                    <span className="material-count-badge">{s.material_count} material{s.material_count !== 1 ? "s" : ""}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Supplier</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Supplier Name *</label>
                <input name="name" value={form.name} onChange={handleChange} placeholder="e.g., Manila Leather Supply" />
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
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} rows="2" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierView;
