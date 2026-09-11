import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import InventoryView from "./views/InventoryView";
import SupplierView from "./views/SupplierView";
import ScrapView from "./views/ScrapView";
import api from "../../lib/api";
import AIAssistantFloat from "../../components/dashboard/AIAssistantFloat";
import "../../styles/dashboard.css";

const formatDate = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

/* Helper to construct SKU */
const getSKU = (material) => {
  const name = material.material_name || material.name || "";
  if (name.includes("Cowhide Black")) return "CH-BLK-001";
  if (name.includes("Rubber Sole")) return "RS-42-002";
  if (name.includes("Goatskin Brown")) return "GS-BRN-003";
  if (name.includes("Adhesive")) return "AD-CC-004";

  // Default generator
  const words = name.split(" ");
  const p1 = words[0] ? words[0].substring(0, 2).toUpperCase() : "MT";
  const p2 = words[1] ? words[1].substring(0, 3).toUpperCase() : "XX";
  const idNum = material.id ? material.id.substring(0, 3).toUpperCase() : "001";
  return `${p1}-${p2}-${idNum}`;
};

/* Stock health bar — shows current vs min as a fill percentage */
const StockBar = ({ current, min }) => {
  const pct = min > 0 ? Math.min((current / min) * 100, 100) : 100;
  const isOut = current === 0;
  const isLow = current > 0 && current < min;
  const color = isOut ? "#DC2626" : isLow ? "#D97706" : "#059669";
  return (
    <div className="clerk-stock-bar-wrap">
      <div
        className="clerk-stock-bar-fill"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
};

/* ── Dynamic Home View for Clerk ───────────────── */
const EmployeeHomeView = ({ onNavClick }) => {
  const { fullName } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [scraps, setScraps] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resMat, resScraps] = await Promise.all([
          api.get("/inventory/materials/"),
          api.get("/inventory/scrap/"),
        ]);
        setMaterials(resMat.data.results || resMat.data);
        setScraps(resScraps.data.results || resScraps.data);
      } catch (err) {
        console.error("Error fetching clerk home data:", err);
      }
    };
    fetchData();
  }, []);

  // Calculations
  const rawMaterialsTotal = materials.reduce((sum, m) => sum + m.quantity, 0);
  const lowStockItems = materials.filter(
    (m) => m.stock_status === "low_stock" || m.stock_status === "out_of_stock"
  );
  const outOfStockItems = materials.filter((m) => m.stock_status === "out_of_stock" || m.quantity === 0);
  const lowStockCount = lowStockItems.length;
  const outOfStockCount = outOfStockItems.length;
  const availableScraps = scraps.filter((s) => s.status === "available");
  const totalAvailableScrapKg = availableScraps.reduce(
    (sum, s) => sum + Number(s.weight_kg),
    0
  );

  // First name only for greeting
  const firstName = fullName ? fullName.split(" ")[0] : "there";

  return (
    <>
      {/* ── Personalized Greeting Banner ── */}
      <div className="clerk-greeting-banner">
        <div className="clerk-greeting-left">
          <div className="clerk-greeting-avatar">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="clerk-greeting-title">
              {getGreeting()}, {firstName}! 👋
            </h1>
            <p className="clerk-greeting-sub">
              {formatDate()} &nbsp;·&nbsp;
              {outOfStockCount > 0 ? (
                <span className="clerk-greeting-alert">
                  ⚠ {outOfStockCount} item{outOfStockCount !== 1 ? "s" : ""} out of stock — action needed
                </span>
              ) : lowStockCount > 0 ? (
                <span className="clerk-greeting-warn">
                  {lowStockCount} item{lowStockCount !== 1 ? "s" : ""} running low
                </span>
              ) : (
                <span className="clerk-greeting-ok">✓ All stock levels look healthy</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="clerk-quick-actions">
        <button className="clerk-qa-btn" onClick={() => onNavClick("inventory")}>
          <span className="clerk-qa-icon" style={{ background: "rgba(123,31,31,0.1)", color: "var(--primary)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="clerk-qa-label">Add Stock</span>
        </button>
        <button className="clerk-qa-btn" onClick={() => onNavClick("scrap")}>
          <span className="clerk-qa-icon" style={{ background: "#FEF3C7", color: "#D97706" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </span>
          <span className="clerk-qa-label">Log Scrap</span>
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="stat-cards">
        {/* Raw Materials total */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Raw Materials</span>
            <div className="stat-card-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value">{rawMaterialsTotal.toLocaleString()}</div>
          <div className="stat-card-sub">
            Total units in inventory
          </div>
        </div>

        {/* Out of Stock — replaces the old redundant "Low Stock Items" card */}
        <div className="stat-card" style={outOfStockCount > 0 ? { borderColor: "#FECACA", background: "#FFF5F5" } : {}}>
          <div className="stat-card-header">
            <span className="stat-card-label">Out of Stock</span>
            <div className="stat-card-icon" style={{ color: "#DC2626", backgroundColor: "#FEE2E2" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value" style={outOfStockCount > 0 ? { color: "#DC2626" } : {}}>
            {outOfStockCount}
          </div>
          <div className="stat-card-sub" style={outOfStockCount > 0 ? { color: "#DC2626" } : {}}>
            {outOfStockCount > 0 ? "Needs immediate reorder" : "No items depleted"}
          </div>
        </div>

        {/* Scrap Available */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Scrap Available</span>
            <div className="stat-card-icon" style={{ color: "#059669", backgroundColor: "#D1FAE5" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value">{totalAvailableScrapKg.toFixed(2)} kg</div>
          <div className="stat-card-sub">Available for sale</div>
        </div>
      </div>

      {/* ── Low Stock Items Table ── */}
      <div className="dashboard-card" style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, marginBottom: "1.25rem" }}>
          <h3 className="dashboard-card-title" style={{ margin: 0 }}>
            Low Stock Items
            {lowStockCount > 0 && (
              <span className="clerk-table-badge">{lowStockCount}</span>
            )}
          </h3>
          {lowStockCount > 0 && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Sorted by urgency
            </span>
          )}
        </div>

        {lowStockItems.length === 0 ? (
          /* All-clear empty state */
          <div className="clerk-all-clear">
            <div className="clerk-all-clear-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="clerk-all-clear-title">All materials are well-stocked!</p>
            <p className="clerk-all-clear-sub">No items need reordering right now. Keep up the great work.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", boxShadow: "none", overflowY: "auto", maxHeight: "340px" }}>
            <table className="data-table">
              <thead style={{ position: "sticky", top: 0, background: "#FAFAFA", zIndex: 1 }}>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Min</th>
                  <th>Health</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Sort: out-of-stock first, then lowest stock */}
                {[...lowStockItems]
                  .sort((a, b) => a.quantity - b.quantity)
                  .map((item) => {
                    const isOut = item.quantity === 0 || item.stock_status === "out_of_stock";
                    const minVal = item.min_stock || item.reorder_level || 0;
                    return (
                      <tr
                        key={item.id}
                        className={isOut ? "row-danger" : "row-warning"}
                      >
                        <td style={{ fontSize: "0.8rem", fontWeight: "600" }}>
                          {item.material_name || item.name}
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {getSKU(item)}
                        </td>
                        <td style={{ fontWeight: "800", color: isOut ? "#DC2626" : "#D97706" }}>
                          {item.quantity}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>{minVal}</td>
                        <td style={{ minWidth: "100px" }}>
                          <StockBar current={item.quantity} min={minVal} />
                        </td>
                        <td>
                          <span className={`status-badge ${isOut ? "badge-danger" : "badge-warning"}`}>
                            {isOut ? "Out of Stock" : "Low Stock"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════ */

export const EmployeeDashboard = () => {
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
      default:
        return <EmployeeHomeView onNavClick={setActiveNav} />;
    }
  };

  return (
    <div className={`dashboard-layout ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        activeItem={activeNav}
        onNavClick={setActiveNav}
        userName={fullName || "Employee"}
        userRole="Inventory Clerk"
      />
      <main className="dashboard-main">
        {renderView()}
      </main>

      {/* AI Assistant — floating on all employee pages */}
      <AIAssistantFloat />
    </div>
  );
};

export default EmployeeDashboard;
