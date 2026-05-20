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
};

export const ReportsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const res = await api.get("/inventory/logs/", { params });
      setLogs(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Audit Trail</h2>
      </div>

      <div className="view-filters">
        <input
          type="text"
          className="filter-input"
          placeholder="Search by user, action, or details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                      {log.action_display}
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
