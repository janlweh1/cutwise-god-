import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import InventoryView from "./views/InventoryView";
import SupplierView from "./views/SupplierView";
import ScrapView from "./views/ScrapView";
import api from "../../lib/api";
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



/* ── Dynamic Home View for Clerk ───────────────── */
const EmployeeHomeView = () => {
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
  const lowStockItems = materials.filter(m => m.stock_status === "low_stock" || m.stock_status === "out_of_stock");
  const lowStockCount = lowStockItems.length;
  const availableScraps = scraps.filter((s) => s.status === "available");
  const totalAvailableScrapKg = availableScraps.reduce((sum, s) => sum + Number(s.weight_kg), 0);


  return (
    <>
      <div className="dashboard-header">
        <h1>Inventory Operations</h1>
        <p className="dashboard-header-date">{formatDate()}</p>
      </div>

      {/* Summary Cards */}
      <div className="stat-cards">
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
          <div className="stat-card-value">{rawMaterialsTotal}</div>
          <div className="stat-card-sub warning">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {lowStockCount} low stock alert{lowStockCount !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Low Stock Items</span>
            <div className="stat-card-icon" style={{ color: "#D97706", backgroundColor: "#FEF3C7" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value">{lowStockCount}</div>
          <div className="stat-card-sub">Need reorder</div>
        </div>

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

      {/* Low Stock Items Table */}
      <div className="dashboard-card" style={{ marginBottom: "1.5rem", maxHeight: "320px", display: "flex", flexDirection: "column" }}>
        <h3 className="dashboard-card-title" style={{ flexShrink: 0 }}>Low Stock Items</h3>
        {lowStockItems.length === 0 ? (
          <div className="view-empty" style={{ padding: "1.5rem" }}>All materials in stock!</div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", boxShadow: "none", overflowY: "auto", flex: 1 }}>
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
                    <td style={{ fontSize: "0.8rem", fontWeight: "600" }}>{item.material_name || item.name}</td>
                    <td style={{ fontSize: "0.8rem" }}>{getSKU(item)}</td>
                    <td style={{ color: "var(--text-red)", fontWeight: "700" }}>
                      {item.quantity}
                    </td>
                    <td>{item.min_stock || item.reorder_level}</td>
                  </tr>
                ))}
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
        return <EmployeeHomeView />;
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
    </div>
  );
};

export default EmployeeDashboard;
