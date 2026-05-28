import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import InventoryView from "./views/InventoryView";
import SupplierView from "./views/SupplierView";
import ReportsView from "./views/ReportsView";
import "../../styles/dashboard.css";

/* ── Simple Home View for Supervisor ──────────── */

const formatDate = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const SupervisorHomeView = ({ fullName }) => (
  <>
    <div className="dashboard-header">
      <h1>Welcome back, {fullName || "Supervisor"}!</h1>
      <p className="dashboard-header-date">{formatDate()}</p>
    </div>
    <div className="view-container">
      <div className="welcome-card">
        <div className="welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h3>Supervisor Dashboard</h3>
        <p>Monitor inventory levels, view scrap records, and review the audit trail using the sidebar navigation.</p>
        <p className="welcome-hint">Your session will expire after 30 minutes of inactivity.</p>
      </div>
    </div>
  </>
);

/* ═══════════════════════════════════════════════ */

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

export const SupervisorDashboard = () => {
  const { fullName } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("home");

  const renderView = () => {
    switch (activeNav) {
      case "inventory":
        return <InventoryView />;
      case "scrap":
        return <ScrapPlaceholder />;
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

