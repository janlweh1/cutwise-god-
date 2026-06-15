import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import { StatCard, StatCards } from "../../components/dashboard/StatCard";
import InventoryView from "./views/InventoryView";
import SupplierView from "./views/SupplierView";
import ReportsView from "./views/ReportsView";
import ScrapView from "./views/ScrapView";
import api from "../../lib/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import "../../styles/dashboard.css";

/* ── Constants ──────────────────────────────── */

const DONUT_COLORS = ["#7B1F1F", "#C9252C", "#D4956A", "#E8B89D", "#9CA3AF", "#6B7280", "#4B5563", "#374151", "#A16207", "#059669", "#2563EB"];

const MATERIAL_TYPE_LABELS = {
  cowhide: "Cowhide",
  goatskin: "Goatskin",
  sheepskin: "Sheepskin",
  suede: "Suede",
  nappa: "Nappa Leather",
  synthetic: "Synthetic Leather",
  rubber: "Rubber",
  thread: "Thread",
  adhesive: "Adhesive",
  accessory: "Accessory",
  other: "Other",
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

/* ── Custom Tooltip for Pie Chart ────────────── */

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div style={{
        backgroundColor: "#fff",
        border: "1px solid var(--border-color)",
        borderRadius: "6px",
        padding: "0.6rem 0.8rem",
        boxShadow: "var(--shadow-md)",
        fontSize: "0.8rem",
      }}>
        <p style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--text-dark)" }}>{entry.name}</p>
        <p style={{ color: entry.payload.fill, margin: 0 }}>
          {entry.value} unit{entry.value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
};

/* ── Helper: construct SKU ───────────────────── */

const getSKU = (material) => {
  const name = material.material_name || material.name || "";
  const words = name.split(" ");
  const p1 = words[0] ? words[0].substring(0, 2).toUpperCase() : "MT";
  const p2 = words[1] ? words[1].substring(0, 3).toUpperCase() : "XX";
  const idNum = material.id ? String(material.id).substring(0, 3).toUpperCase() : "001";
  return `${p1}-${p2}-${idNum}`;
};

/* ── Activity Logs Helpers ───────────────────── */

const formatTimeElapsed = (timestampStr) => {
  const date = new Date(timestampStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 60) {
    return diffMins <= 0 ? "Just now" : `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }
};

const ActivityIcon = ({ type }) => {
  const icons = {
    scrap_sold: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    scrap_recorded: (
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

const getActivityInfo = (log) => {
  const map = {
    scrap_sold: { label: "Scrap Sale", className: "sale" },
    scrap_recorded: { label: "Scrap Recorded", className: "inventory" },
    stock_adjusted: { label: "Stock Adjusted", className: "inventory" },
    material_added: { label: "Material Added", className: "success" },
    material_updated: { label: "Material Updated", className: "inventory" },
    material_deleted: { label: "Material Deleted", className: "alert" },
    supplier_added: { label: "Supplier Added", className: "success" },
  };
  return map[log.action] || { label: "Activity", className: "inventory" };
};

/* ── Dynamic Supervisor Home View ────────────── */

const SupervisorHomeView = ({ fullName }) => {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [scraps, setScraps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resMat, resSuppliers, resLogs, resScraps] = await Promise.all([
          api.get("/inventory/materials/"),
          api.get("/inventory/suppliers/"),
          api.get("/inventory/logs/"),
          api.get("/inventory/scrap/"),
        ]);
        setMaterials(resMat.data.results || resMat.data);
        setSuppliers(resSuppliers.data.results || resSuppliers.data);
        setLogs((resLogs.data.results || resLogs.data).slice(0, 5));
        setScraps(resScraps.data.results || resScraps.data);
      } catch (err) {
        console.error("Error fetching supervisor home data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* ── Computed stats ──────────────────────────── */
  const rawMaterialsTotal = materials.reduce((sum, m) => sum + m.quantity, 0);
  const inventoryValue = materials.reduce((sum, m) => sum + Number(m.total_value || 0), 0);
  const lowStockItems = materials.filter(m => m.stock_status === "low_stock" || m.stock_status === "out_of_stock");
  const lowStockCount = lowStockItems.length;
  const totalSuppliers = suppliers.length;
  const availableScraps = scraps.filter((s) => s.status === "available");
  const totalAvailableScrapKg = availableScraps.reduce((sum, s) => sum + Number(s.weight_kg), 0);

  /* ── Inventory distribution for donut chart ──── */
  const typeDistribution = materials.reduce((acc, m) => {
    const label = MATERIAL_TYPE_LABELS[m.material_type] || m.material_type || "Other";
    acc[label] = (acc[label] || 0) + m.quantity;
    return acc;
  }, {});
  const donutData = Object.entries(typeDistribution)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      {/* Header */}
      <div className="dashboard-header">
        <h1>Welcome back, {fullName || "Supervisor"}!</h1>
        <p className="dashboard-header-date">{formatDate()}</p>
      </div>

      {loading ? (
        <div className="view-loading">Loading dashboard data...</div>
      ) : (
        <>
          {/* Stat Cards */}
          <StatCards>
            <StatCard
              label="Raw Materials"
              value={rawMaterialsTotal.toLocaleString()}
              variant={lowStockCount > 0 ? "alert" : undefined}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
              subClassName={lowStockCount > 0 ? "warning" : undefined}
              sub={
                lowStockCount > 0 ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {lowStockCount} low stock alert{lowStockCount !== 1 ? "s" : ""}
                  </>
                ) : "All items well-stocked"
              }
            />
            <StatCard
              label="Inventory Value"
              value={`₱${inventoryValue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              }
              sub="Total stock value"
            />
            <StatCard
              label="Scrap Weight"
              value={`${totalAvailableScrapKg.toFixed(2)} kg`}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              }
              sub="Available for sale"
            />
            <StatCard
              label="Active Suppliers"
              value={totalSuppliers.toLocaleString()}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              sub="Registered suppliers"
            />
          </StatCards>

          {/* Charts + Low Stock Table */}
          <div className="charts-section">
            {/* Inventory Distribution Donut */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h3 className="chart-card-title">Inventory Distribution</h3>
              </div>
              {donutData.length === 0 ? (
                <div className="view-empty" style={{ padding: "2rem" }}>No materials in inventory yet.</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {donutData.map((_, idx) => (
                          <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-legend">
                    {donutData.map((entry, idx) => (
                      <div key={entry.name} className="donut-legend-item">
                        <span className="donut-legend-dot" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Low Stock Items Table */}
            <div className="chart-card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="chart-card-header">
                <h3 className="chart-card-title">Low Stock Items</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  {lowStockCount} item{lowStockCount !== 1 ? "s" : ""}
                </span>
              </div>
              {lowStockItems.length === 0 ? (
                <div className="view-empty" style={{ padding: "2rem", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: "0.5rem" }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>All materials well-stocked!</p>
                  </div>
                </div>
              ) : (
                <div className="table-wrapper" style={{ border: "none", boxShadow: "none", overflowY: "auto", flex: 1, maxHeight: "260px" }}>
                  <table className="data-table">
                    <thead style={{ position: "sticky", top: 0, background: "#FAFAFA", zIndex: 1 }}>
                      <tr>
                        <th>Item</th>
                        <th>SKU</th>
                        <th>Stock</th>
                        <th>Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockItems.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontSize: "0.8rem", fontWeight: "600" }}>{item.material_name}</td>
                          <td style={{ fontSize: "0.8rem" }}>{getSKU(item)}</td>
                          <td style={{ color: "var(--text-red)", fontWeight: "700" }}>{item.quantity}</td>
                          <td>{item.min_stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="activity-section">
            <h3 className="activity-title">Recent Activity</h3>
            {logs.length === 0 ? (
              <div className="view-empty">No recent activity logs.</div>
            ) : (
              <div className="activity-list">
                {logs.map((log) => {
                  const actInfo = getActivityInfo(log);
                  return (
                    <div key={log.id} className="activity-item">
                      <div className={`activity-icon ${actInfo.className}`}>
                        <ActivityIcon type={log.action} />
                      </div>
                      <div className="activity-content">
                        <div className="activity-content-title">{actInfo.label}</div>
                        <div className="activity-content-desc">{log.details}</div>
                      </div>
                      <div className="activity-time">{formatTimeElapsed(log.timestamp)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

/* ── Scrap Placeholder ──────────────────────── */

const ScrapPlaceholder = () => (
  <div className="view-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: "1rem", textAlign: "center" }}>
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
    <h2 style={{ fontSize: "1.75rem", fontWeight: "800", color: "var(--text-dark)", fontFamily: "var(--font-heading)" }}>Scrap Management</h2>
    <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", maxWidth: "480px", lineHeight: 1.6 }}>
      Waiting for sales subsystem integration
    </p>
  </div>
);

/* ═══════════════════════════════════════════════ */

export const SupervisorDashboard = () => {
  const { fullName } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("home");

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
      default:
        return <SupervisorHomeView fullName={fullName} />;
    }
  };

  return (
    <div className={`dashboard-layout ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        activeItem={activeNav}
        onNavClick={setActiveNav}
        userName={fullName || "Supervisor"}
        userRole="Production Supervisor"
      />
      <main className="dashboard-main">
        {renderView()}
      </main>
    </div>
  );
};

export default SupervisorDashboard;

