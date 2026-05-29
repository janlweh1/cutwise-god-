import { useState, useEffect, useCallback } from "react";
import api from "../../../lib/api";

const ACTION_COLORS = {
  material_added: "#059669",
  material_updated: "#2563EB",
  material_deleted: "#DC2626",
  scrap_recorded: "#D97706",
  scrap_converted: "#7C3AED",
  stock_adjusted: "#0891B2",
  supplier_added: "#059669",
  config_updated: "#111827",
};

export const ReportsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  // Fetch unique users for the dropdown list
  useEffect(() => {
    const fetchUsersList = async () => {
      try {
        const res = await api.get("/inventory/logs/");
        const data = res.data.results || res.data;
        const users = [...new Set(data.map((log) => log.username).filter(Boolean))];
        setAllUsers(users);
      } catch (err) {
        console.error("Failed to fetch users list:", err);
      }
    };
    fetchUsersList();
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (userFilter) params.username = userFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateFilter) params.date = dateFilter;
      const res = await api.get("/inventory/logs/", { params });
      setLogs(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search, userFilter, actionFilter, dateFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Audit Trail</h2>
      </div>

      <div className="view-filters" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <input
          type="text"
          className="filter-input"
          style={{ flex: "1 1 200px" }}
          placeholder="Search details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="filter-input"
          style={{ flex: "1 1 150px" }}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">All Users</option>
          {allUsers.map((user) => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>

        <select
          className="filter-input"
          style={{ flex: "1 1 150px" }}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="material_added">Material Added</option>
          <option value="material_updated">Material Updated</option>
          <option value="material_deleted">Material Deleted</option>
          <option value="scrap_recorded">Scrap Recorded</option>
          <option value="scrap_sold">Scrap Sold</option>
          <option value="stock_adjusted">Stock Adjusted</option>
          <option value="supplier_added">Supplier Added</option>
          <option value="config_updated">Configuration Updated</option>
        </select>

        <input
          type="date"
          className="filter-input"
          style={{ flex: "1 1 150px" }}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />

        {(search || userFilter || actionFilter || dateFilter) && (
          <button
            className="btn btn-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            onClick={() => {
              setSearch("");
              setUserFilter("");
              setActionFilter("");
              setDateFilter("");
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="view-loading">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="view-empty">No audit records found.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="td-muted">
                    {new Date(log.timestamp).toLocaleString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="td-bold">{log.username || "System"}</td>
                  <td>
                    <span
                      className="action-badge"
                      style={{ backgroundColor: ACTION_COLORS[log.action] || "#6B7280", color: "#fff" }}
                    >
                      {log.action_display || log.action}
                    </span>
                  </td>
                  <td>{log.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
