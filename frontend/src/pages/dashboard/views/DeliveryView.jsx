import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

const emptyForm = {
  batch_number: "",
  material_name: "",
  quantity: "",
  size: "",
  supplier: "",
};

export const DeliveryView = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const res = await api.get("/inventory/deliveries/", { params });
      let data = res.data.results || res.data;
      if (statusFilter) {
        data = data.filter((d) => d.status === statusFilter);
      }
      setDeliveries(data);
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
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
    fetchDeliveries();
    fetchSuppliers();
  }, [fetchDeliveries, fetchSuppliers]);

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
    if (!form.batch_number.trim()) errs.batch_number = "Batch number is required.";
    if (!form.material_name.trim()) errs.material_name = "Material name is required.";
    if (!form.quantity || Number(form.quantity) <= 0) errs.quantity = "Quantity must be greater than 0.";
    if (!form.supplier) errs.supplier = "Supplier is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post("/inventory/deliveries/", {
        batch_number: form.batch_number.trim(),
        material_name: form.material_name.trim(),
        quantity: Number(form.quantity),
        size: form.size.trim(),
        supplier: form.supplier,
        status: "pending",
      });
      showNotif("Shipment scheduled successfully.");
      setShowModal(false);
      setForm(emptyForm);
      fetchDeliveries();
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const fieldErrs = {};
        for (const [key, val] of Object.entries(data)) {
          fieldErrs[key] = Array.isArray(val) ? val.join(" ") : String(val);
        }
        setErrors(fieldErrs);
      } else {
        showNotif("Failed to schedule shipment.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (id, batchNumber) => {
    try {
      await api.post(`/inventory/deliveries/${id}/receive/`);
      showNotif(`Delivery received and stock updated for ${batchNumber}!`);
      fetchDeliveries();
    } catch (err) {
      console.error(err);
      showNotif("Failed to receive delivery.", "error");
    }
  };

  return (
    <div className="view-container">
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.message}</div>
      )}

      <div className="view-header">
        <h2 className="view-title">Delivery Operations</h2>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setForm(emptyForm); setErrors({}); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Schedule Shipment
        </button>
      </div>

      <div className="view-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search by batch or material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="received">Received</option>
        </select>
      </div>

      {loading ? (
        <div className="view-loading">Loading shipments...</div>
      ) : deliveries.length === 0 ? (
        <div className="view-empty">No shipments found. Schedule your first delivery above.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Material</th>
                <th>Supplier</th>
                <th>Quantity / Size</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Received At / Clerk</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className={d.status === "pending" ? "row-warning" : ""}>
                  <td className="td-bold">{d.batch_number}</td>
                  <td>{d.material_name}</td>
                  <td>{d.supplier_name || "—"}</td>
                  <td>
                    {d.quantity} {d.size && `(${d.size})`}
                  </td>
                  <td className="td-muted">
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`status-badge ${d.status === "received" ? "badge-success" : "badge-warning"}`}>
                      {d.status === "received" ? "Received" : "Pending"}
                    </span>
                  </td>
                  <td className="td-muted">
                    {d.status === "received" ? (
                      <>
                        {new Date(d.received_at).toLocaleDateString()}
                        <br />
                        <span style={{ fontSize: "0.75rem", fontWeight: "600" }}>
                          by {d.received_by_name || "System"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {d.status === "pending" ? (
                      <button
                        className="action-badge badge-success"
                        style={{ border: "none", cursor: "pointer" }}
                        onClick={() => handleReceive(d.id, d.batch_number)}
                      >
                        Receive
                      </button>
                    ) : (
                      <span className="td-muted">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule Delivery Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Incoming Shipment</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Batch Number *</label>
                <input
                  name="batch_number"
                  value={form.batch_number}
                  onChange={handleChange}
                  placeholder="e.g. Batch #2413"
                />
                {errors.batch_number && <span className="form-error">{errors.batch_number}</span>}
              </div>

              <div className="form-group">
                <label>Material Name *</label>
                <input
                  name="material_name"
                  value={form.material_name}
                  onChange={handleChange}
                  placeholder="e.g. Premium Cowhide Black"
                />
                {errors.material_name && <span className="form-error">{errors.material_name}</span>}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={handleChange}
                  />
                  {errors.quantity && <span className="form-error">{errors.quantity}</span>}
                </div>
                <div className="form-group">
                  <label>Size / Unit</label>
                  <input
                    name="size"
                    value={form.size}
                    onChange={handleChange}
                    placeholder="e.g. 12 sqft, 1 roll"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Supplier *</label>
                <select name="supplier" value={form.supplier} onChange={handleChange}>
                  <option value="">— Select Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.supplier && <span className="form-error">{errors.supplier}</span>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryView;
