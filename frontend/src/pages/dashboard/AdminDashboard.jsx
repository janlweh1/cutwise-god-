import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import { StatCard, StatCards } from "../../components/dashboard/StatCard";
import InventoryView from "./views/InventoryView";
import SupplierView from "./views/SupplierView";
import ReportsView from "./views/ReportsView";
import ScrapView from "./views/ScrapView";
import ConfigurationView from "./views/ConfigurationView";
import api from "../../lib/api";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import "../../styles/dashboard.css";

/* ── Constants ──────────────────────────────── */

const CHART_COLORS = [
  "#7B1F1F", // Otto Primary Crimson
  "#A02929",
  "#C9252C",
  "#D4956A",
  "#E8B89D",
  "#059669",
  "#2563EB",
  "#6B7280",
];

const MATERIAL_TYPE_LABELS = {
  cowhide: "Cowhide",
  goatskin: "Goatskin",
  sheepskin: "Sheepskin",
  suede: "Suede",
  nappa: "Nappa Leather",
  synthetic: "Synthetic Leather",
  other: "Other",
};

const ROLE_DISPLAY = {
  admin: { label: "Admin", bg: "#FEE2E2", color: "#991B1B" },
  supervisor: { label: "Supervisor", bg: "#DBEAFE", color: "#1E40AF" },
  inventory_clerk: { label: "Inventory Clerk", bg: "#D1FAE5", color: "#065F46" },
};

/* ── Helper: Format today's date ────────────── */

const formatDate = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/* ── Dynamic time elapsed formatter ─────────── */

const formatTimeElapsed = (timestampStr) => {
  if (!timestampStr) return "Recently";
  const date = new Date(timestampStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

/* ── Activity Icon by Type ──────────────────── */

const ActivityIcon = ({ type }) => {
  const icons = {
    scrap_sold: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    scrap_stock_added: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    ),
    stock_adjusted: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    material_added: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    material_updated: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    material_deleted: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
    supplier_added: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  };
  return icons[type] || (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
};

/* Helper to convert database action string to activity details */
const getActivityInfo = (log) => {
  const map = {
    scrap_sold: { label: "Scrap Sale", className: "sale" },
    scrap_stock_added: { label: "Scrap Stock Added", className: "inventory" },
    stock_adjusted: { label: "Stock Adjusted", className: "inventory" },
    material_added: { label: "Material Added", className: "success" },
    material_updated: { label: "Material Updated", className: "inventory" },
    material_deleted: { label: "Material Deleted", className: "alert" },
    supplier_added: { label: "Supplier Added", className: "success" },
  };
  return map[log.action] || { label: "Activity", className: "inventory" };
};

/* ── Custom Tooltip for Bar Chart ────────────── */

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div style={{
        backgroundColor: "#fff",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        padding: "0.6rem 0.85rem",
        boxShadow: "var(--shadow-md)",
        fontSize: "0.8rem",
      }}>
        <p style={{ fontWeight: 700, margin: "0 0 0.25rem 0", color: "var(--text-dark)" }}>{entry.name}</p>
        <p style={{ color: entry.payload.fill || "var(--primary)", margin: 0, fontWeight: 700 }}>
          {Number(entry.value).toLocaleString()} unit{entry.value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
};

/* ── Helper: construct SKU ───────────────────── */

const getSKU = (material) => {
  const name = material.material_name || material.name || "";
  if (name.includes("Cowhide Black")) return "CH-BLK-001";
  if (name.includes("Rubber Sole")) return "RS-42-002";
  if (name.includes("Goatskin Brown")) return "GS-BRN-003";
  if (name.includes("Adhesive")) return "AD-CC-004";

  const words = name.split(" ");
  const p1 = words[0] ? words[0].substring(0, 2).toUpperCase() : "MT";
  const p2 = words[1] ? words[1].substring(0, 3).toUpperCase() : "XX";
  const idNum = material.id ? String(material.id).substring(0, 3).toUpperCase() : "001";
  return `${p1}-${p2}-${idNum}`;
};

/* ── Modern Dynamic Admin Home View ──────────── */

const AdminHomeView = ({ onNavigate, fullName }) => {
  const [summary, setSummary] = useState(null);          // DB-level aggregates
  const [lowStockItems, setLowStockItems] = useState([]); // watchlist rows
  const [suppliers, setSuppliers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [
        resSummary,
        resLowStock,
        resSuppliers,
        resLogs,
        resUsers,
      ] = await Promise.allSettled([
        // Single DB-aggregate query — accurate for any number of records
        api.get("/inventory/materials/summary/"),
        // Fetch only low/out-of-stock rows needed for the watchlist table
        api.get("/inventory/materials/", { params: { stock_status: "low_stock", page_size: 200 } }),
        api.get("/inventory/suppliers/"),
        api.get("/inventory/logs/"),
        api.get("/auth/users/"),
      ]);

      if (resSummary.status === "fulfilled") {
        setSummary(resSummary.value.data);
      }
      if (resLowStock.status === "fulfilled") {
        const d = resLowStock.value.data;
        // Combine low-stock + out-of-stock rows for the watchlist
        const lowRows = d.results || d || [];
        // Also fetch out-of-stock rows separately so the watchlist is complete
        try {
          const resOut = await api.get("/inventory/materials/", {
            params: { stock_status: "out_of_stock", page_size: 200 },
          });
          const outRows = resOut.data.results || resOut.data || [];
          setLowStockItems([...lowRows, ...outRows]);
        } catch {
          setLowStockItems(lowRows);
        }
      }
      if (resSuppliers.status === "fulfilled") {
        setSuppliers(resSuppliers.value.data.results || resSuppliers.value.data || []);
      }
      if (resLogs.status === "fulfilled") {
        const logData = resLogs.value.data.results || resLogs.value.data || [];
        setLogs(logData.slice(0, 6));
      }
      if (resUsers.status === "fulfilled") {
        setUsers(resUsers.value.data || []);
      }
    } catch (err) {
      console.error("Error fetching admin home data:", err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ── Stats derived from the summary endpoint (accurate for all record counts) ── */
  const rawMaterialsTotal = summary?.total_units ?? 0;
  const inventoryValue    = summary ? Number(summary.total_value) : 0;
  const lowStockCount     = summary ? (summary.low_stock_count + summary.out_of_stock_count) : 0;
  const totalMaterials    = summary?.total_materials ?? 0;

  /* User breakdown stats */
  const totalUsers     = users.length;
  const activeUsers    = useMemo(() => users.filter(u => u.is_active).length, [users]);
  const disabledUsers  = totalUsers - activeUsers;
  const adminCount     = useMemo(() => users.filter(u => u.role === "admin").length, [users]);
  const supervisorCount = useMemo(() => users.filter(u => u.role === "supervisor").length, [users]);
  const clerkCount     = useMemo(() => users.filter(u => u.role === "inventory_clerk").length, [users]);

  /* ── Inventory distribution for bar chart (from summary endpoint) ── */
  const chartData = useMemo(() => {
    if (!summary?.type_distribution) return [];
    return summary.type_distribution
      .filter(d => (d.total_units ?? 0) > 0)
      .map(d => ({
        name: MATERIAL_TYPE_LABELS[d.material_type] || d.material_type || "Other",
        value: d.total_units,
      }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  return (
    <>
      {/* ── Admin Hero Banner ──────────────────────── */}
      <div className="admin-hero-banner">
        <div className="clerk-hero-content">
          <h1 className="clerk-hero-title">
            Welcome back, {fullName || "Administrator"}!
          </h1>
          <div className="clerk-hero-sub">
            <span>{formatDate()}</span>
            <span className="role-pill-admin">
              <span className="clerk-status-dot" style={{ backgroundColor: "#991B1B", boxShadow: "0 0 0 2px rgba(153, 27, 27, 0.3)" }}></span>
              System Governance & Operations Online
            </span>
          </div>
        </div>

        <div className="clerk-hero-actions">
          <button
            className="clerk-btn-primary"
            onClick={() => onNavigate("configuration")}
            title="Manage user roles, accounts, and system configuration"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            User Accounts
          </button>
          <button
            className="clerk-btn-secondary"
            onClick={() => onNavigate("audit_trail")}
            title="Generate audit trail reports and export logs"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Audit Reports
          </button>
          <button
            className="clerk-btn-secondary"
            onClick={() => onNavigate("inventory")}
            title="Inspect warehouse inventory registry"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Inventory Master
          </button>
          <button
            className="clerk-btn-icon"
            onClick={() => fetchData(true)}
            title="Refresh System Data"
            disabled={refreshing}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="view-loading">Loading administrator dashboard...</div>
      ) : (
        <>
          {/* ── 4 Executive KPI Stat Cards ─────────────── */}
          <StatCards>
            <StatCard
              label="Inventory Valuation"
              value={`₱${inventoryValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              }
              sub={`${rawMaterialsTotal.toLocaleString()} total units in stock`}
            />

            <StatCard
              label="Staff User Accounts"
              value={`${totalUsers} Accounts`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              sub={
                <span className="stat-badge-chip" style={{ background: disabledUsers > 0 ? "#FEF3C7" : "#D1FAE5", color: disabledUsers > 0 ? "#92400E" : "#065F46" }}>
                  {activeUsers} Active {disabledUsers > 0 ? `• ${disabledUsers} Disabled` : "• All Active"}
                </span>
              }
            />

            <StatCard
              label="Stock Replenishment Health"
              value={lowStockCount === 0 ? "100% Healthy" : `${lowStockCount} Need Restock`}
              variant={lowStockCount > 0 ? "alert-state" : "healthy-state"}
              icon={
                lowStockCount > 0 ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )
              }
              subClassName={lowStockCount > 0 ? "warning" : undefined}
              sub={
                lowStockCount > 0 ? (
                  <span className="stat-badge-chip warning">
                    {lowStockCount} below minimum safety threshold
                  </span>
                ) : (
                  <span className="stat-badge-chip success">
                    Safety margins satisfied
                  </span>
                )
              }
            />

            <StatCard
              label="Registered Suppliers"
              value={suppliers.length.toLocaleString()}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              sub="Contracted vendor directory"
            />
          </StatCards>

          {/* ── Executive Governance Launchers ────────── */}
          <div className="clerk-quick-grid">
            <div className="clerk-quick-card" onClick={() => onNavigate("configuration")}>
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap admin-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                  IAM & Security
                </span>
              </div>
              <h4>User & Role Governance</h4>
              <p>Manage staff accounts, assign roles, reset passwords, and resend activation links.</p>
              <span className="clerk-quick-link">Open User Configuration →</span>
            </div>

            <div className="clerk-quick-card" onClick={() => onNavigate("audit_trail")}>
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap audit-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
                  Governance
                </span>
              </div>
              <h4>Audit Trail & Reports</h4>
              <p>Generate formal PDF and Excel reports, monitor user logins, and verify system audit trails.</p>
              <span className="clerk-quick-link">Generate Reports & Logs →</span>
            </div>

            <div className="clerk-quick-card" onClick={() => onNavigate("inventory")}>
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap inventory-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                  Asset Control
                </span>
              </div>
              <h4>Master Inventory Registry</h4>
              <p>Oversee all material classifications, valuation records, pagination, and stock thresholds.</p>
              <span className="clerk-quick-link">Inspect {totalMaterials} Materials →</span>
            </div>

            <div className="clerk-quick-card" onClick={() => onNavigate("supplier")}>
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap supplier-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#DCFCE7", color: "#166534" }}>
                  Partners
                </span>
              </div>
              <h4>Supplier Partner Network</h4>
              <p>Review supplier profiles, delivery terms, and vendor contacts for procurement oversight.</p>
              <span className="clerk-quick-link">View {suppliers.length} Registered Suppliers →</span>
            </div>
          </div>

          {/* ── Two-Column Executive Hub ───────────────── */}
          <div className="clerk-ops-grid">
            {/* Left Column: Inventory Distribution + Low Stock Escalations */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Material Asset Distribution */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Leather Stock & Valuation Distribution
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    {chartData.length} grades cataloged
                  </span>
                </div>

                {chartData.length === 0 ? (
                  <div className="view-empty" style={{ padding: "2rem" }}>No inventory data available.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        axisLine={{ stroke: "#E5E7EB" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.04)" }} />
                      <Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={28}>
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Critical Low Stock Escalation Watchlist */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Stock Replenishment Watchlist
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: lowStockCount > 0 ? "#DC2626" : "var(--text-muted)", fontWeight: 700 }}>
                    {lowStockCount} items flagged
                  </span>
                </div>

                {lowStockItems.length === 0 ? (
                  <div className="clerk-healthy-state">
                    <div className="clerk-healthy-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <h4 className="clerk-healthy-title">Stock Health Fully Satisfied</h4>
                    <p className="clerk-healthy-desc">
                      All inventory materials are currently stocked above their defined safety limits.
                    </p>
                  </div>
                ) : (
                  <div className="table-wrapper" style={{ border: "none", boxShadow: "none", overflowY: "auto", maxHeight: "250px" }}>
                    <table className="data-table">
                      <thead style={{ position: "sticky", top: 0, background: "#FAFAFA", zIndex: 1 }}>
                        <tr>
                          <th>Material</th>
                          <th>SKU</th>
                          <th>Stock</th>
                          <th>Safety Min</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockItems.map((item) => {
                          const isOut = item.quantity === 0 || item.stock_status === "out_of_stock";
                          return (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 600, color: "var(--text-dark)" }}>{item.material_name}</td>
                              <td style={{ fontSize: "0.78rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{getSKU(item)}</td>
                              <td style={{ fontWeight: 700, color: isOut ? "#DC2626" : "#D97706" }}>{item.quantity}</td>
                              <td style={{ color: "var(--text-muted)" }}>{item.min_stock}</td>
                              <td>
                                <span className={`reorder-urgency-badge ${isOut ? "out" : "critical"}`}>
                                  {isOut ? "Out of Stock" : "Low Stock"}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                                  onClick={() => onNavigate("inventory")}
                                >
                                  Manage
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: User Security Roster (Admin Exclusive!) + System Activity Stream */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* User Accounts & IAM Oversight Panel */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    User Accounts & IAM Roster
                  </h3>
                  <button
                    onClick={() => onNavigate("configuration")}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Manage Users ({totalUsers}) →
                  </button>
                </div>

                {/* Role Breakdown Mini Cards */}
                <div className="admin-role-breakdown">
                  <div className="admin-role-mini-card">
                    <div className="count" style={{ color: "#991B1B" }}>{adminCount}</div>
                    <div className="label">Admins</div>
                  </div>
                  <div className="admin-role-mini-card">
                    <div className="count" style={{ color: "#1E40AF" }}>{supervisorCount}</div>
                    <div className="label">Supervisors</div>
                  </div>
                  <div className="admin-role-mini-card">
                    <div className="count" style={{ color: "#065F46" }}>{clerkCount}</div>
                    <div className="label">Clerks</div>
                  </div>
                </div>

                {/* Mini User List */}
                {users.length === 0 ? (
                  <div className="view-empty" style={{ padding: "1.25rem" }}>No user accounts loaded.</div>
                ) : (
                  <div className="admin-user-mini-list">
                    {users.slice(0, 4).map((u) => {
                      const roleConfig = ROLE_DISPLAY[u.role] || { label: u.role, bg: "#F3F4F6", color: "#374151" };
                      const initials = u.full_name ? u.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "U";
                      return (
                        <div key={u.id} className="admin-user-mini-row">
                          <div className="admin-user-mini-info">
                            <div className="admin-user-avatar">{initials}</div>
                            <div>
                              <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--text-dark)" }}>{u.full_name}</div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.email}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: roleConfig.bg, color: roleConfig.color }}>
                              {roleConfig.label}
                            </span>
                            <span className={`stat-badge-chip ${u.is_active ? "success" : "warning"}`}>
                              {u.is_active ? "Active" : "Disabled"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* System Activity Stream */}
              <div className="clerk-ops-panel" style={{ flex: 1 }}>
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    System Audit Stream
                  </h3>
                  <button
                    onClick={() => onNavigate("audit_trail")}
                    style={{ background: "none", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Full Audit Log →
                  </button>
                </div>

                {logs.length === 0 ? (
                  <div className="view-empty" style={{ padding: "1.5rem" }}>No recent activity logs.</div>
                ) : (
                  <div className="activity-list" style={{ marginTop: 0 }}>
                    {logs.map((log) => {
                      const actInfo = getActivityInfo(log);
                      return (
                        <div key={log.id} className="activity-item" style={{ padding: "0.6rem 0" }}>
                          <div className={`activity-icon ${actInfo.className}`}>
                            <ActivityIcon type={log.action} />
                          </div>
                          <div className="activity-content">
                            <div className="activity-content-title" style={{ fontSize: "0.82rem" }}>{actInfo.label}</div>
                            <div className="activity-content-desc" style={{ fontSize: "0.76rem" }}>{log.details}</div>
                          </div>
                          <div className="activity-time" style={{ fontSize: "0.7rem" }}>{formatTimeElapsed(log.timestamp)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════
   AdminDashboard Root Component
   ═══════════════════════════════════════════════ */

export const AdminDashboard = () => {
  const { fullName } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("home");

  /* ── Render sub-view based on sidebar selection ── */
  const renderView = () => {
    switch (activeNav) {
      case "inventory":
        return <InventoryView />;
      case "scrap":
        return <ScrapView />;
      case "supplier":
        return <SupplierView />;
      case "audit_trail":
        return <ReportsView />;
      case "configuration":
        return <ConfigurationView />;
      default:
        return <AdminHomeView onNavigate={setActiveNav} fullName={fullName} />;
    }
  };

  return (
    <div className={`dashboard-layout ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        activeItem={activeNav}
        onNavClick={setActiveNav}
        userName={fullName || "Manager"}
        userRole="Admin"
      />

      <main className="dashboard-main">
        {renderView()}
      </main>
    </div>
  );
};

export default AdminDashboard;

