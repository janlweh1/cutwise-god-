import { useState, useEffect } from "react";
import api from "../../../lib/api";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

/* ── Constants ───────────────────────────────── */

const RISK_COLORS = {
  CRITICAL: "#DC2626",
  HIGH:     "#D97706",
  MEDIUM:   "#2563EB",
  LOW:      "#059669",
};

const CHART_COLORS = [
  "#7B1F1F", "#C9252C", "#D4956A", "#E8B89D",
  "#9CA3AF", "#6B7280", "#4B5563", "#A16207",
  "#059669", "#2563EB", "#7C3AED",
];

const fmt = (n, dec = 2) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

/* ── Reusable KPI Card ───────────────────────── */

const KpiCard = ({ label, value, sub, accent, icon }) => {
  const strVal = String(value ?? "");
  const valFontSize = strVal.length > 13 ? "1.1rem" : strVal.length > 9 ? "1.25rem" : "1.45rem";

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "0.85rem 0.95rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      borderLeft: `4px solid ${accent || "#7B1F1F"}`,
      minWidth: 0,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        color: "#6B7280",
        fontSize: "0.72rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {icon && <span style={{ color: accent || "#7B1F1F", flexShrink: 0, display: "inline-flex" }}>{icon}</span>}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
      <div style={{
        fontSize: valFontSize,
        fontWeight: 800,
        color: "#111827",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }} title={strVal}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: "0.72rem",
          color: "#9CA3AF",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
};

/* ── Risk Badge ──────────────────────────────── */

const RiskBadge = ({ level }) => (
  <span style={{
    display: "inline-block",
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
    fontSize: "0.7rem",
    fontWeight: 700,
    background: `${RISK_COLORS[level] || "#6B7280"}20`,
    color: RISK_COLORS[level] || "#6B7280",
    border: `1px solid ${RISK_COLORS[level] || "#6B7280"}40`,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}>
    {level}
  </span>
);

/* ── Section Header ──────────────────────────── */

const SectionHeader = ({ title, sub, badge }) => (
  <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>{title}</h3>
      {sub && <p style={{ margin: 0, fontSize: "0.75rem", color: "#9CA3AF", marginTop: "0.15rem" }}>{sub}</p>}
    </div>
    {badge && (
      <span style={{
        background: "#FEF2F2",
        color: "#DC2626",
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "0.2rem 0.6rem",
        borderRadius: "999px",
        border: "1px solid #FECACA",
      }}>{badge}</span>
    )}
  </div>
);

/* ── Chart Card Wrapper ──────────────────────── */

const ChartCard = ({ title, sub, children, style }) => (
  <div style={{
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    ...style,
  }}>
    <SectionHeader title={title} sub={sub} />
    {children}
  </div>
);

/* ── Custom Tooltip ──────────────────────────── */

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        padding: "0.6rem 0.9rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        fontSize: "0.8rem",
      }}>
        <p style={{ margin: "0 0 0.25rem", fontWeight: 700, color: "#111827" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ margin: 0, color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const LeftAlignedTick = ({ y, payload }) => (
  <text x={0} y={y} dy={4} fill="#4B5563" fontSize={11} fontWeight={600} textAnchor="start">
    {payload.value}
  </text>
);

/* ── Loading State ───────────────────────────── */

const LoadingSpinner = () => (
  <div style={{ textAlign: "center", padding: "3rem", color: "#9CA3AF" }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
    <p style={{ marginTop: "0.75rem", fontWeight: 500 }}>Loading analytics data…</p>
  </div>
);

/* ── No DB Banner ────────────────────────────── */

const NoDbBanner = () => (
  <div style={{
    background: "#FEF3C7",
    border: "1px solid #FCD34D",
    borderRadius: "10px",
    padding: "1.25rem 1.5rem",
    marginBottom: "1.5rem",
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
  }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: "1px" }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
    <div>
      <div style={{ fontWeight: 700, color: "#92400E", marginBottom: "0.25rem" }}>Analytics database not found</div>
      <div style={{ fontSize: "0.8rem", color: "#B45309" }}>
        Run <code style={{ background: "#FDE68A", padding: "0.1rem 0.35rem", borderRadius: "4px", fontFamily: "monospace" }}>python -m apps.analytics.extract_data</code> in your backend terminal first.
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   AnalyticsView — Main Component
   ═══════════════════════════════════════════════ */

const AnalyticsView = () => {
  const [summary, setSummary]         = useState(null);
  const [riskScores, setRiskScores]   = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [userActivity, setUserActivity]         = useState([]);
  const [actionDist, setActionDist]             = useState([]);
  const [dailyTrend, setDailyTrend]             = useState([]);
  const [extractLog, setExtractLog]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [noDb, setNoDb]               = useState(false);
  const [activeTab, setActiveTab]     = useState("overview");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [resSummary, resRisk, resPred, resUser, resAction, resTrend, resLog] =
          await Promise.all([
            api.get("/analytics/summary/"),
            api.get("/analytics/risk-scores/"),
            api.get("/analytics/predictions/"),
            api.get("/analytics/user-activity/"),
            api.get("/analytics/action-distribution/"),
            api.get("/analytics/daily-trend/"),
            api.get("/analytics/extraction-log/"),
          ]);
        setSummary(resSummary.data);
        setRiskScores(resRisk.data);
        setPredictions(resPred.data);
        setUserActivity(resUser.data);
        setActionDist(resAction.data);
        setDailyTrend(resTrend.data);
        setExtractLog(resLog.data);
      } catch (err) {
        if (err.response?.status === 404) {
          setNoDb(true);
        }
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const tabs = [
    { id: "overview",     label: "Overview" },
    { id: "predictions",  label: "AI Predictions" },
    { id: "risk",         label: "Risk Scores" },
    { id: "activity",     label: "User Activity" },
  ];

  const criticalCount = riskScores.filter(r => r.risk_level === "CRITICAL").length;
  const reorderCount  = predictions.filter(p => p.reorder_recommended).length;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .analytics-tab-btn {
          padding: 0.45rem 1rem;
          border-radius: 8px;
          border: 1px solid #E5E7EB;
          background: #fff;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          color: #6B7280;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .analytics-tab-btn:hover { border-color: #7B1F1F; color: #7B1F1F; }
        .analytics-tab-btn.active {
          background: #7B1F1F;
          color: #fff;
          border-color: #7B1F1F;
        }
        .analytics-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .analytics-table th {
          text-align: left; padding: 0.6rem 0.75rem;
          background: #F9FAFB; color: #6B7280; font-weight: 600;
          text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em;
          border-bottom: 1px solid #E5E7EB;
        }
        .analytics-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #F3F4F6; color: #111827; }
        .analytics-table tr:last-child td { border-bottom: none; }
        .analytics-table tr:hover td { background: #F9FAFB; }
        .reorder-yes { color: #DC2626; font-weight: 700; }
        .reorder-no  { color: #059669; font-weight: 600; }
        .conf-high   { color: #059669; }
        .conf-medium { color: #D97706; }
        .conf-low    { color: #9CA3AF; }
      `}</style>

      {/* Header */}
      <div className="dashboard-header">
        <h1>Analytics & AI Predictions</h1>
      </div>

      {/* No DB warning */}
      {noDb && <NoDbBanner />}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* ── Tab Navigation ── */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {tabs.map(t => (
              <button
                key={t.id}
                className={`analytics-tab-btn ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════
              TAB: OVERVIEW
          ══════════════════════════════════ */}
          {activeTab === "overview" && (
            <>
              {/* KPI Cards — Single Row Layout (6 columns) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <KpiCard
                  label="Total Materials"
                  value={summary?.total_materials ?? "—"}
                  sub="Tracked in inventory"
                  accent="#7B1F1F"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
                />
                <KpiCard
                  label="Inventory Value"
                  value={summary ? `₱${fmt(summary.total_inventory_value)}` : "—"}
                  sub="Total stock value"
                  accent="#059669"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
                />
                <KpiCard
                  label="Critical Risk"
                  value={`${criticalCount} material${criticalCount !== 1 ? "s" : ""}`}
                  sub="Need immediate attention"
                  accent="#DC2626"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                />
                <KpiCard
                  label="Reorder Needed"
                  value={`${reorderCount} material${reorderCount !== 1 ? "s" : ""}`}
                  sub="AI-recommended reorders"
                  accent="#D97706"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>}
                />
                <KpiCard
                  label="At-Risk Items"
                  value={summary?.materials_at_risk ?? "—"}
                  sub="Low / out-of-stock"
                  accent="#7C3AED"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                />
                <KpiCard
                  label="Avg Days to Min Stock"
                  value={summary ? `${summary.avg_days_to_min_stock}d` : "—"}
                  sub="AI Linear Regression forecast"
                  accent="#2563EB"
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                />
              </div>

              {/* Stock Status Distribution */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <ChartCard title="Stock Status Distribution" sub="Current stock health across all materials">
                  {summary ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          { name: "In Stock",     value: summary.in_stock_count,     fill: "#059669" },
                          { name: "Low Stock",    value: summary.low_stock_count,    fill: "#D97706" },
                          { name: "Out of Stock", value: summary.out_of_stock_count, fill: "#DC2626" },
                        ]}
                        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                          {[
                            { fill: "#059669" }, { fill: "#D97706" }, { fill: "#DC2626" }
                          ].map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>No data</div>
                  )}
                </ChartCard>

                <ChartCard title="Action Distribution" sub="Audit log event breakdown (from analytics.db)">
                  {actionDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={actionDist.slice(0, 7)}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                        <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="action_type" type="category" tick={<LeftAlignedTick />} axisLine={false} tickLine={false} width={130} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                          {actionDist.slice(0, 7).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>No data</div>
                  )}
                </ChartCard>
              </div>

              {/* Daily Activity Trend */}
              <ChartCard title="Daily Activity Trend" sub="Audit event volume over time (from analytics.db)" style={{ marginBottom: "1rem" }}>
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={dailyTrend} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="event_count" stroke="#7B1F1F" strokeWidth={2} dot={{ r: 3, fill: "#7B1F1F" }} name="Events" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>No trend data</div>
                )}
              </ChartCard>
            </>
          )}

          {/* ══════════════════════════════════
              TAB: AI PREDICTIONS
          ══════════════════════════════════ */}
          {activeTab === "predictions" && (
            <ChartCard
              title="AI Stock Depletion Predictions"
              sub="Linear Regression model — trained on audit log activity as consumption proxy"
              badge={`${reorderCount} Reorders Needed`}
            >
              <div style={{ overflowX: "auto" }}>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Type</th>
                      <th>Current Stock</th>
                      <th>Min Stock</th>
                      <th>Daily Rate</th>
                      <th>7-Day Forecast</th>
                      <th>14-Day Forecast</th>
                      <th>30-Day Forecast</th>
                      <th>Days to Min</th>
                      <th>Depletion Date</th>
                      <th>Reorder?</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{p.material_name}</td>
                        <td style={{ color: "#6B7280", textTransform: "capitalize" }}>{p.material_type}</td>
                        <td style={{ fontWeight: 700 }}>{p.current_stock}</td>
                        <td style={{ color: "#9CA3AF" }}>{p.min_stock}</td>
                        <td>{p.daily_consumption_rate}</td>
                        <td style={{ color: Number(p.predicted_stock_7d) <= p.min_stock ? "#DC2626" : "#059669", fontWeight: 600 }}>
                          {p.predicted_stock_7d}
                        </td>
                        <td style={{ color: Number(p.predicted_stock_14d) <= p.min_stock ? "#DC2626" : "#059669", fontWeight: 600 }}>
                          {p.predicted_stock_14d}
                        </td>
                        <td style={{ color: Number(p.predicted_stock_30d) <= p.min_stock ? "#DC2626" : "#D97706", fontWeight: 600 }}>
                          {p.predicted_stock_30d}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {p.days_until_min_stock === 999 ? "Stable" : `${p.days_until_min_stock}d`}
                        </td>
                        <td style={{ fontSize: "0.72rem" }}>{p.estimated_depletion_date}</td>
                        <td className={p.reorder_recommended ? "reorder-yes" : "reorder-no"}>
                          {p.reorder_recommended ? "YES" : "No"}
                        </td>
                        <td className={`conf-${(p.confidence || "").toLowerCase()}`}>
                          {p.confidence}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#F0FDF4", borderRadius: "8px", border: "1px solid #BBF7D0", fontSize: "0.78rem", color: "#166534" }}>
                <strong>Model:</strong> Linear Regression (scikit-learn) &nbsp;·&nbsp;
                <strong>Input:</strong> Audit log event frequency as consumption proxy &nbsp;·&nbsp;
                <strong>Trigger:</strong> Reorder recommended if stock hits min within 14 days
              </div>
            </ChartCard>
          )}

          {/* ══════════════════════════════════
              TAB: RISK SCORES
          ══════════════════════════════════ */}
          {activeTab === "risk" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(level => {
                  const count = riskScores.filter(r => r.risk_level === level).length;
                  return (
                    <div key={level} style={{
                      background: `${RISK_COLORS[level]}10`,
                      border: `2px solid ${RISK_COLORS[level]}30`,
                      borderRadius: "10px",
                      padding: "1rem",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: RISK_COLORS[level] }}>{count}</div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: RISK_COLORS[level], textTransform: "uppercase", letterSpacing: "0.06em" }}>{level}</div>
                    </div>
                  );
                })}
              </div>

              <ChartCard title="Material Risk Scores" sub="Risk = 1 − (quantity / (min_stock × 2)), clamped 0–1. Higher = more at-risk.">
                <div style={{ marginBottom: "1rem" }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={riskScores.slice(0, 15)}
                      margin={{ top: 8, right: 8, left: -20, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis
                        dataKey="material_name"
                        tick={{ fill: "#9CA3AF", fontSize: 9 }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis domain={[0, 1]} tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="risk_score" radius={[4, 4, 0, 0]} barSize={22} name="Risk Score">
                        {riskScores.slice(0, 15).map((r, i) => (
                          <Cell key={i} fill={RISK_COLORS[r.risk_level] || "#9CA3AF"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ overflowX: "auto", maxHeight: "300px", overflowY: "auto" }}>
                  <table className="analytics-table">
                    <thead style={{ position: "sticky", top: 0 }}>
                      <tr>
                        <th>Material</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Min</th>
                        <th>Buffer</th>
                        <th>Risk Score</th>
                        <th>Risk Level</th>
                        <th>Stock Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskScores.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{r.material_name}</td>
                          <td style={{ color: "#6B7280", textTransform: "capitalize" }}>{r.material_type}</td>
                          <td style={{ fontWeight: 700 }}>{r.quantity}</td>
                          <td style={{ color: "#9CA3AF" }}>{r.min_stock}</td>
                          <td style={{ color: r.buffer_units < 0 ? "#DC2626" : "#059669", fontWeight: 600 }}>
                            {r.buffer_units}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: "#E5E7EB", overflow: "hidden" }}>
                                <div style={{ width: `${r.risk_score * 100}%`, height: "100%", background: RISK_COLORS[r.risk_level] || "#9CA3AF", borderRadius: "3px" }} />
                              </div>
                              <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>{r.risk_score}</span>
                            </div>
                          </td>
                          <td><RiskBadge level={r.risk_level} /></td>
                          <td style={{ color: "#6B7280", textTransform: "capitalize", fontSize: "0.75rem" }}>
                            {r.stock_status?.replace("_", " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            </>
          )}

          {/* ══════════════════════════════════
              TAB: USER ACTIVITY
          ══════════════════════════════════ */}
          {activeTab === "activity" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <ChartCard title="User Activity" sub="Total actions per user from analytics.db">
                {userActivity.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={userActivity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="username" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="total_actions" radius={[6, 6, 0, 0]} barSize={40} name="Actions">
                          {userActivity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <table className="analytics-table" style={{ marginTop: "1rem" }}>
                      <thead><tr><th>User</th><th>Total Actions</th><th>First Action</th><th>Last Action</th></tr></thead>
                      <tbody>
                        {userActivity.map((u, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{u.username}</td>
                            <td style={{ fontWeight: 700, color: "#7B1F1F" }}>{u.total_actions}</td>
                            <td style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{u.first_action}</td>
                            <td style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{u.last_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>No data</div>
                )}
              </ChartCard>

              <ChartCard title="Action Type Distribution" sub="Breakdown of audit events by type">
                {actionDist.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={actionDist} layout="vertical" margin={{ top: 4, right: 16, left: 100, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                        <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="action_type" type="category" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} width={98} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16} name="Count">
                          {actionDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <table className="analytics-table" style={{ marginTop: "1rem" }}>
                      <thead><tr><th>Action Type</th><th>Count</th></tr></thead>
                      <tbody>
                        {actionDist.map((a, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{a.action_type}</td>
                            <td style={{ fontWeight: 700 }}>{a.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#9CA3AF" }}>No data</div>
                )}
              </ChartCard>
            </div>
          )}


        </>
      )}
    </>
  );
};

export default AnalyticsView;
