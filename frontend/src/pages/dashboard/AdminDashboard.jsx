import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import { StatCard, StatCards } from "../../components/dashboard/StatCard";
import InventoryView from "./views/InventoryView";
import ScrapView from "./views/ScrapView";
import SupplierView from "./views/SupplierView";
import ReportsView from "./views/ReportsView";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import "../../styles/dashboard.css";

/* ── Mock Data ──────────────────────────────── */

const barData = [
  { month: "Jan", sales: 12, profit: 8 },
  { month: "Feb", sales: 95, profit: 18 },
  { month: "Mar", sales: 170, profit: 25 },
  { month: "Apr", sales: 120, profit: 15 },
  { month: "May", sales: 80, profit: 20 },
  { month: "Jun", sales: 45, profit: 22 },
];

const donutData = [
  { name: "Cowhide", value: 35 },
  { name: "Goatskin", value: 25 },
  { name: "Sheepskin", value: 18 },
  { name: "Suede", value: 12 },
  { name: "Accessories", value: 10 },
];

const DONUT_COLORS = ["#7B1F1F", "#C9252C", "#D4956A", "#E8B89D", "#9CA3AF"];

const recentActivity = [
  {
    type: "sale",
    title: "Scrap Sale",
    desc: "Sold 4.2kg Goatskin scrap to Artisan Crafts Co.",
    time: "2 hours ago",
  },
  {
    type: "alert",
    title: "Stock Alert",
    desc: "Nappa Leather below threshold (22 remaining)",
    time: "5 hours ago",
  },
  {
    type: "delivery",
    title: "Delivery Received",
    desc: "120 sqft Cowhide from Manila Leather Supply",
    time: "Yesterday",
  },
  {
    type: "success",
    title: "Inventory Updated",
    desc: "Monthly stock count completed and verified",
    time: "2 days ago",
  },
];

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

/* ── Activity Icon by Type ──────────────────── */

const ActivityIcon = ({ type }) => {
  const icons = {
    sale: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    alert: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    delivery: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  };
  return icons[type] || null;
};

/* ── Custom Tooltip for Bar Chart ────────────── */

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: "#fff",
        border: "1px solid var(--border-color)",
        borderRadius: "6px",
        padding: "0.6rem 0.8rem",
        boxShadow: "var(--shadow-md)",
        fontSize: "0.8rem",
      }}>
        <p style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--text-dark)" }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color, margin: 0 }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/* ── Home View (Dashboard Overview) ──────────── */

const HomeView = ({ fullName }) => {
  const [chartPeriod, setChartPeriod] = useState("6m");

  return (
    <>
      {/* Header */}
      <div className="dashboard-header">
        <h1>Home</h1>
        <p className="dashboard-header-date">{formatDate()}</p>
      </div>

      {/* Stat Cards */}
      <StatCards>
        <StatCard
          label="Raw Materials"
          value="415"
          variant="alert"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
          subClassName="warning"
          sub={
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              3 low stock alerts
            </>
          }
        />
        <StatCard
          label="Inventory Value"
          value="₱28,450"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          }
          sub="Total stock value"
        />
        <StatCard
          label="Scrap Weight"
          value="50.6 kg"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          }
          sub="Available for sale"
        />
        <StatCard
          label="Scrap Profit"
          value="₱157.6"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          }
          sub="5 sales this month"
        />
      </StatCards>

      {/* Charts */}
      <div className="charts-section">
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Scrap Sales & Profit</h3>
            <div className="chart-period-toggles">
              <button className={`chart-period-btn ${chartPeriod === "1m" ? "active" : ""}`} onClick={() => setChartPeriod("1m")}>1 Month</button>
              <button className={`chart-period-btn ${chartPeriod === "3m" ? "active" : ""}`} onClick={() => setChartPeriod("3m")}>3 Months</button>
              <button className={`chart-period-btn ${chartPeriod === "6m" ? "active" : ""}`} onClick={() => setChartPeriod("6m")}>6 Months</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#9CA3AF" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Sales" fill="#D4956A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#7B1F1F" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Inventory Distribution</h3>
          </div>
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
              <Tooltip
                formatter={(value, name) => [`${value}%`, name]}
                contentStyle={{
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-md)",
                  fontSize: "0.8rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-legend">
            {donutData.map((entry, idx) => (
              <div key={entry.name} className="donut-legend-item">
                <span className="donut-legend-dot" style={{ backgroundColor: DONUT_COLORS[idx] }} />
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <h3 className="activity-title">Recent Activity</h3>
        <div className="activity-list">
          {recentActivity.map((item, idx) => (
            <div key={idx} className="activity-item">
              <div className={`activity-icon ${item.type}`}>
                <ActivityIcon type={item.type} />
              </div>
              <div className="activity-content">
                <div className="activity-content-title">{item.title}</div>
                <div className="activity-content-desc">{item.desc}</div>
              </div>
              <div className="activity-time">{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════
   AdminDashboard Component
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
      case "reports":
        return <ReportsView />;
      case "settings":
        return (
          <div className="view-container">
            <div className="view-header"><h2 className="view-title">Settings</h2></div>
            <div className="view-empty">Settings module coming soon.</div>
          </div>
        );
      default:
        return <HomeView fullName={fullName} />;
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
