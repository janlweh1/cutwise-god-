import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import InventoryView from "./views/InventoryView";
import ScrapView from "./views/ScrapView";
import SupplierView from "./views/SupplierView";
import DeliveryView from "./views/DeliveryView";
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

/* ── Custom Activity Icon ── */
const ActivityIcon = ({ type }) => {
  const icons = {
    scrap_sold: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    delivery_received: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
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
    delivery_received: { label: "Delivery", className: "delivery" },
    stock_adjusted: { label: "Inventory", className: "inventory" },
    material_added: { label: "Inventory", className: "inventory" },
    material_updated: { label: "Inventory", className: "inventory" },
  };
  return map[log.action] || { label: "Inventory", className: "inventory" };
};

/* Dynamic time elapsed formatter */
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

const DEFAULT_TASKS = [
  { id: 1, text: "Receive Cowhide delivery - Batch #2410", completed: false },
  { id: 2, text: "Record scrap from cutting station B", completed: true },
  { id: 3, text: "Update stock count for Goatskin Brown", completed: false },
  { id: 4, text: "Confirm outbound delivery #DO-8812", completed: false },
  { id: 5, text: "Print inventory report for Supervisor", completed: true },
];

/* ── Dynamic Home View for Clerk ───────────────── */
const EmployeeHomeView = () => {
  const [materials, setMaterials] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [scraps, setScraps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("clerk_tasks");
    return saved ? JSON.parse(saved) : DEFAULT_TASKS;
  });

  useEffect(() => {
    localStorage.setItem("clerk_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch raw materials
        const resMat = await api.get("/inventory/materials/");
        const rawMaterials = resMat.data.results || resMat.data;
        setMaterials(rawMaterials);

        // Fetch deliveries
        const resDeliv = await api.get("/inventory/deliveries/");
        setDeliveries(resDeliv.data.results || resDeliv.data);

        // Fetch scraps
        const resScrap = await api.get("/inventory/scrap/");
        setScraps(resScrap.data.results || resScrap.data);

        // Fetch recent logs
        const resLogs = await api.get("/inventory/logs/");
        setLogs((resLogs.data.results || resLogs.data).slice(0, 5));
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
  const pendingDeliveriesCount = deliveries.filter(d => d.status === "pending").length;

  // Scrap recorded today
  const scrapTodayWeight = scraps.reduce((sum, s) => {
    const sDate = new Date(s.recorded_date).toDateString();
    const today = new Date().toDateString();
    if (sDate === today) {
      return sum + Number(s.weight_kg);
    }
    return sum;
  }, 0);

  // Toggle tasks
  const handleToggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

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
            <span className="stat-card-label">Pending Deliveries</span>
            <div className="stat-card-icon" style={{ color: "#2563EB", backgroundColor: "#DBEAFE" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value">{pendingDeliveriesCount}</div>
          <div className="stat-card-sub">Awaiting receipt</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Scrap Today</span>
            <div className="stat-card-icon" style={{ color: "#059669", backgroundColor: "#D1FAE5" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </div>
          </div>
          <div className="stat-card-value">{scrapTodayWeight > 0 ? `${scrapTodayWeight.toFixed(1)} kg` : "4.2 kg"}</div>
          <div className="stat-card-sub">Recorded from floor</div>
        </div>
      </div>

      {/* Grid: Tasks and Low Stock Items */}
      <div className="clerk-home-grid">
        {/* Today's Tasks */}
        <div className="dashboard-card">
          <h3 className="dashboard-card-title">Today's Tasks</h3>
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.id} className="task-item" onClick={() => handleToggleTask(task.id)}>
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={task.completed}
                  onChange={() => {}} // Handled by container
                />
                <span className={`task-text ${task.completed ? "completed" : ""}`}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Items Table */}
        <div className="dashboard-card">
          <h3 className="dashboard-card-title">Low Stock Items</h3>
          {lowStockItems.length === 0 ? (
            <div className="view-empty" style={{ padding: "1.5rem" }}>All materials in stock!</div>
          ) : (
            <div className="table-wrapper" style={{ border: "none", boxShadow: "none" }}>
              <table className="data-table">
                <thead>
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
      </div>

      {/* Recent Activity Feed */}
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
      case "delivery":
        return <DeliveryView />;
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
