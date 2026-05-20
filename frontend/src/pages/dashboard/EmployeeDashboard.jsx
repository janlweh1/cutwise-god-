import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import InventoryView from "./views/InventoryView";
import ScrapView from "./views/ScrapView";
import SupplierView from "./views/SupplierView";
import "../../styles/dashboard.css";

/* ── Simple Home View for Employee ────────────── */

const formatDate = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const EmployeeHomeView = ({ fullName }) => (
  <>
    <div className="dashboard-header">
      <h1>Welcome back, {fullName || "Employee"}!</h1>
      <p className="dashboard-header-date">{formatDate()}</p>
    </div>
    <div className="view-container">
      <div className="welcome-card">
        <div className="welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <h3>Employee Dashboard</h3>
        <p>Use the sidebar to navigate to Inventory Management, Scrap Management, or Supplier Reference.</p>
        <p className="welcome-hint">Your session will expire after 30 minutes of inactivity.</p>
      </div>
    </div>
  </>
);

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
        return <EmployeeHomeView fullName={fullName} />;
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
