import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import api from "../../../lib/api";

/* ── Constants ───────────────────────────────── */

const ROLE_OPTIONS = [
  { value: "inventory_clerk", label: "Inventory Clerk" },
  { value: "supervisor",      label: "Supervisor"      },
  { value: "admin",           label: "Admin"           },
];

const ROLE_COLORS = {
  admin:            { bg: "#FEE2E2", color: "#991B1B" },
  supervisor:       { bg: "#DBEAFE", color: "#1E40AF" },
  inventory_clerk:  { bg: "#D1FAE5", color: "#065F46" },
};

const SYSTEM_INFO = [
  { label: "API Version",            value: "v1" },
  { label: "Authentication",         value: "JWT (Bearer Token)" },
  { label: "Access Token Lifetime",  value: "30 minutes" },
  { label: "Refresh Token Lifetime", value: "7 days" },
  { label: "Default Page Size",      value: "20 records" },
  { label: "Time Zone",              value: "UTC" },
  { label: "Database",               value: "PostgreSQL" },
  { label: "Framework",              value: "Django REST Framework" },
];

/* ── Role Badge ──────────────────────────────── */
const RoleBadge = ({ role, display }) => {
  const c = ROLE_COLORS[role] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      letterSpacing: "0.03em",
      background: c.bg,
      color: c.color,
    }}>
      {display}
    </span>
  );
};

/* ── Tab Bar ─────────────────────────────────── */
const TabBar = ({ tabs, active, onSelect }) => (
  <div style={{
    display: "flex",
    gap: "0.25rem",
    marginBottom: "1.5rem",
    borderBottom: "2px solid var(--border-color)",
  }}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        id={`config-tab-${tab.id}`}
        onClick={() => onSelect(tab.id)}
        style={{
          padding: "0.55rem 1.1rem",
          border: "none",
          borderBottom: active === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
          background: "transparent",
          cursor: "pointer",
          fontWeight: active === tab.id ? 700 : 500,
          color: active === tab.id ? "var(--primary)" : "var(--text-muted)",
          fontSize: "0.875rem",
          marginBottom: "-2px",
          transition: "color 0.15s, border-color 0.15s",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        {tab.icon}
        {tab.label}
      </button>
    ))}
  </div>
);

/* ══════════════════════════════════════════════
   Tab A — User Management
   ══════════════════════════════════════════════ */
const UserManagementTab = ({ currentUserId }) => {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [notification, setNotification] = useState(null);
  const [submitting, setSubmitting]     = useState(false);

  const [addForm, setAddForm] = useState({
    full_name: "", email: "", username: "", password: "", role: "inventory_clerk",
  });
  const [addErrors, setAddErrors] = useState({});

  const [editForm, setEditForm] = useState({ full_name: "", role: "inventory_clerk" });

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/users/");
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── Add user ── */
  const validateAdd = () => {
    const errs = {};
    if (!addForm.full_name.trim())  errs.full_name = "Full name is required.";
    if (!addForm.email.trim())      errs.email     = "Email is required.";
    if (!addForm.username.trim())   errs.username  = "Username is required.";
    if (addForm.password.length < 8) errs.password = "Password must be at least 8 characters.";
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateAdd()) return;
    setSubmitting(true);
    try {
      await api.post("/auth/users/", {
        full_name: addForm.full_name.trim(),
        email:     addForm.email.trim(),
        username:  addForm.username.trim(),
        password:  addForm.password,
        role:      addForm.role,
      });
      showNotif("User created successfully.");
      setShowAddModal(false);
      setAddForm({ full_name: "", email: "", username: "", password: "", role: "inventory_clerk" });
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const fieldErrs = {};
        for (const [k, v] of Object.entries(data)) {
          fieldErrs[k] = Array.isArray(v) ? v.join(" ") : String(v);
        }
        setAddErrors(fieldErrs);
      } else {
        showNotif("Failed to create user.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Edit user ── */
  const openEditModal = (user) => {
    setEditTarget(user);
    setEditForm({ full_name: user.full_name || "", role: user.role });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/auth/users/${editTarget.id}/`, {
        full_name: editForm.full_name.trim(),
        role:      editForm.role,
      });
      showNotif("User updated successfully.");
      setEditTarget(null);
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to update user.";
      showNotif(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Deactivate / reactivate ── */
  const handleToggleActive = async (user) => {
    try {
      const res = await api.post(`/auth/users/${user.id}/deactivate/`);
      showNotif(res.data.detail);
      fetchUsers();
    } catch (err) {
      showNotif(err.response?.data?.detail || "Failed to update user status.", "error");
    }
  };

  return (
    <div>
      {notification && (
        <div className={`notif notif-${notification.type}`}>{notification.msg}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.25rem" }}>
        <button
          id="add-user-btn"
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add User
        </button>
      </div>

      {loading ? (
        <div className="view-loading">Loading users...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" id="users-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
                  <td className="td-bold">{u.full_name || "—"}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{u.username}</td>
                  <td style={{ fontSize: "0.82rem" }}>{u.email}</td>
                  <td><RoleBadge role={u.role} display={u.role_display} /></td>
                  <td>
                    <span style={{
                      fontSize: "0.72rem", fontWeight: 700,
                      color: u.is_active ? "#059669" : "#9CA3AF",
                    }}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {new Date(u.date_joined).toLocaleDateString("en-PH", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                      <button
                        className="btn-icon"
                        title="Edit user"
                        id={`edit-user-${u.id}`}
                        onClick={() => openEditModal(u)}
                        disabled={u.id === currentUserId && u.role === "admin"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          className={`btn-icon ${u.is_active ? "btn-icon-danger" : ""}`}
                          title={u.is_active ? "Deactivate user" : "Reactivate user"}
                          id={`toggle-user-${u.id}`}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New User</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="modal-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="e.g., Juan dela Cruz" id="new-user-fullname" />
                {addErrors.full_name && <span className="form-error">{addErrors.full_name}</span>}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Username *</label>
                  <input value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} id="new-user-username" />
                  {addErrors.username && <span className="form-error">{addErrors.username}</span>}
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} id="new-user-role">
                    {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} id="new-user-email" />
                {addErrors.email && <span className="form-error">{addErrors.email}</span>}
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="Min 8 characters" id="new-user-password" />
                {addErrors.password && <span className="form-error">{addErrors.password}</span>}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" id="create-user-submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User</h3>
              <button className="modal-close" onClick={() => setEditTarget(null)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div style={{
                background: "#F9FAFB", borderRadius: "8px", padding: "0.75rem 1rem",
                marginBottom: "0.25rem", fontSize: "0.82rem", color: "var(--text-muted)",
              }}>
                Editing: <strong style={{ color: "var(--text-dark)" }}>{editTarget.email}</strong>
              </div>
              <div className="form-group">
                <label>Full Name</label>
                <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} id="edit-user-fullname" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  id="edit-user-role"
                  disabled={editTarget.id === currentUserId}
                >
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {editTarget.id === currentUserId && (
                  <span className="form-error" style={{ color: "var(--text-muted)" }}>You cannot change your own role.</span>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" id="save-user-btn" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Tab B — System Info
   ══════════════════════════════════════════════ */
const SystemInfoTab = () => (
  <div>
    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
      Read-only snapshot of the current system configuration.
    </p>
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: "1rem",
    }}>
      {SYSTEM_INFO.map((item) => (
        <div key={item.label} style={{
          background: "#fff",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "1rem 1.25rem",
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            {item.label}
          </div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-dark)" }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ══════════════════════════════════════════════
   Tab C — My Account (Change Password)
   ══════════════════════════════════════════════ */
const MyAccountTab = ({ fullName, userEmail }) => {
  const [form, setForm]           = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]     = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.current_password)              errs.current_password  = "Current password is required.";
    if (form.new_password.length < 8)        errs.new_password      = "New password must be at least 8 characters.";
    if (form.new_password !== form.confirm_password)
                                             errs.confirm_password  = "Passwords do not match.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSuccess(false);
    try {
      await api.post("/auth/change-password/", {
        current_password: form.current_password,
        new_password:     form.new_password,
      });
      setSuccess(true);
      setForm({ current_password: "", new_password: "", confirm_password: "" });
      setErrors({});
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to change password.";
      setErrors({ current_password: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "520px" }}>
      {/* Profile Info */}
      <div style={{
        background: "#F9FAFB", border: "1px solid var(--border-color)",
        borderRadius: "10px", padding: "1.25rem 1.5rem",
        marginBottom: "1.75rem", display: "flex", gap: "1rem", alignItems: "center",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "var(--primary)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: "1.1rem", flexShrink: 0,
        }}>
          {fullName ? fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "AD"}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "var(--text-dark)", fontSize: "0.95rem" }}>{fullName || "Admin"}</div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{userEmail}</div>
          <RoleBadge role="admin" display="Admin" />
        </div>
      </div>

      {/* Change Password */}
      <div style={{
        background: "#fff", border: "1px solid var(--border-color)",
        borderRadius: "10px", padding: "1.5rem", boxShadow: "var(--shadow-sm)",
      }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", color: "var(--text-dark)" }}>
          Change Password
        </h3>

        {success && (
          <div style={{
            background: "#D1FAE5", color: "#065F46", borderRadius: "8px",
            padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", fontWeight: 600,
          }}>
            ✓ Password changed successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group">
            <label>Current Password *</label>
            <input
              type="password"
              id="current-password-input"
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              placeholder="Your current password"
            />
            {errors.current_password && <span className="form-error">{errors.current_password}</span>}
          </div>
          <div className="form-group">
            <label>New Password *</label>
            <input
              type="password"
              id="new-password-input"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              placeholder="Min 8 characters"
            />
            {errors.new_password && <span className="form-error">{errors.new_password}</span>}
          </div>
          <div className="form-group">
            <label>Confirm New Password *</label>
            <input
              type="password"
              id="confirm-password-input"
              value={form.confirm_password}
              onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
              placeholder="Re-enter new password"
            />
            {errors.confirm_password && <span className="form-error">{errors.confirm_password}</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" id="change-password-submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   ConfigurationView — Main Component (Admin only)
   ══════════════════════════════════════════════ */

const TABS = [
  {
    id: "users",
    label: "User Management",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "system",
    label: "System Info",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    id: "account",
    label: "My Account",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export const ConfigurationView = () => {
  const { fullName, user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  // Extract current user ID and email from auth context
  const currentUserId = user?.id || null;
  const userEmail = user?.email || "";

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Configuration</h2>
      </div>

      <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />

      {activeTab === "users"   && <UserManagementTab currentUserId={currentUserId} />}
      {activeTab === "system"  && <SystemInfoTab />}
      {activeTab === "account" && <MyAccountTab fullName={fullName} userEmail={userEmail} />}
    </div>
  );
};

export default ConfigurationView;
