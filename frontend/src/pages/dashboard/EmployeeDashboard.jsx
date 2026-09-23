import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/dashboard/Sidebar";
import { StatCard, StatCards } from "../../components/dashboard/StatCard";
import InventoryView from "./views/InventoryView";
import ScrapView from "./views/ScrapView";
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

/* ── Date and Time Formatters ───────────────── */
const formatDate = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTimeElapsed = (timestampStr) => {
  if (!timestampStr) return "Recently";
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return "Recently";
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
  } catch {
    return "Recently";
  }
};

/* ── Helper: construct SKU ──────────────────── */
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

/* ── Custom Tooltip for Leather Distribution Bar Chart ── */
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
          {entry.value.toLocaleString()} unit{entry.value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
};

/* ── Modern Dynamic Home View for Inventory Clerk ── */
const EmployeeHomeView = ({ onNavigate, fullName }) => {
  const [summary, setSummary] = useState(null);             // DB-level aggregates
  const [lowStockItems, setLowStockItems] = useState([]);   // watchlist rows
  const [recentMaterials, setRecentMaterials] = useState([]); // recent updates panel
  const [scraps, setScraps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [resSummary, resLowStock, resScraps, resRecent] = await Promise.allSettled([
        // Single DB-aggregate query — accurate for any number of records
        api.get("/inventory/materials/summary/"),
        // Fetch only low/out-of-stock rows for the watchlist
        api.get("/inventory/materials/", { params: { stock_status: "low_stock", page_size: 200 } }),
        api.get("/inventory/scrap-types/"),
        // 5 most recently updated materials for the Recent Updates panel
        api.get("/inventory/materials/", { params: { ordering: "-last_update", page_size: 5 } }),
      ]);
      if (resSummary.status === "fulfilled") {
        setSummary(resSummary.value.data);
      }
      if (resLowStock.status === "fulfilled") {
        const d = resLowStock.value.data;
        const lowRows = d.results || d || [];
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
      if (resScraps.status === "fulfilled") {
        setScraps(resScraps.value.data.results || resScraps.value.data || []);
      }
      if (resRecent.status === "fulfilled") {
        setRecentMaterials(resRecent.value.data.results || resRecent.value.data || []);
      }
    } catch (err) {
      console.error("Error fetching clerk home data:", err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ── Stats derived from summary endpoint (accurate for all record counts) ── */
  const rawMaterialsTotal = summary?.total_units ?? 0;
  const totalMaterials    = summary?.total_materials ?? 0;
  const lowStockCount     = summary ? (summary.low_stock_count + summary.out_of_stock_count) : 0;
  const inStockCount      = summary ? summary.in_stock_count : 0;
  const inStockPercent    = totalMaterials > 0 ? Math.round((inStockCount / totalMaterials) * 100) : 100;
  const lowStockPercent   = 100 - inStockPercent;

  const totalAvailableScrapKg = useMemo(() => {
    // scraps is now an array of ScrapType objects, each with available_kg
    return scraps.reduce((sum, t) => sum + Number(t.available_kg || 0), 0);
  }, [scraps]);

  /* ── Leather Type Distribution for Bar Chart (from summary endpoint) ── */
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

  const activeTypesCount = chartData.length;

  /* ── Recently updated materials (5 most recent from server) ── */
  const recentUpdates = recentMaterials;

  /* ── Live Quick Stock Search — queries the server ── */
  useEffect(() => {
    if (!quickSearch.trim()) { setSearchResults([]); return; }
    const controller = new AbortController();
    setSearchLoading(true);
    api.get("/inventory/materials/", {
      params: { search: quickSearch.trim(), page_size: 5 },
      signal: controller.signal,
    })
      .then(res => {
        const rows = res.data.results || res.data || [];
        setSearchResults(rows.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
    return () => controller.abort();
  }, [quickSearch]);

  return (
    <>
      {/* ── Modern Clerk Hero Banner ───────────────── */}
      <div className="clerk-hero-banner">
        <div className="clerk-hero-content">
          <h1 className="clerk-hero-title">
            Welcome, {fullName || "Inventory Clerk"}
          </h1>
          <div className="clerk-hero-sub">
            <span>{formatDate()}</span>
            <span className="clerk-status-pill">
              <span className="clerk-status-dot"></span>
              Inventory Operations Active
            </span>
          </div>
        </div>

        <div className="clerk-hero-actions">
          <button
            className="clerk-btn-primary"
            onClick={() => onNavigate("inventory")}
            title="Receive or register raw materials"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Receive Material
          </button>
          <button
            className="clerk-btn-secondary"
            onClick={() => onNavigate("scrap")}
            title="Log scrap from cutting table"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Record Scrap
          </button>
          <button
            className="clerk-btn-icon"
            onClick={() => fetchData(true)}
            title="Refresh Inventory Data"
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
        <div className="view-loading">Loading inventory data...</div>
      ) : (
        <>
          {/* ── 4 Non-Redundant Stat Cards ─────────────── */}
          <StatCards>
            {/* Card 1: Total Stock Volume (Units) - Clean, NO redundant low stock alert */}
            <StatCard
              label="Raw Materials"
              value={rawMaterialsTotal.toLocaleString()}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
              sub={`${totalMaterials} material catalog item${totalMaterials !== 1 ? "s" : ""}`}
            />

            {/* Card 2: Stock Replenishment Status - THE SINGLE DEDICATED PLACE FOR LOW STOCK */}
            <StatCard
              label="Stock Health"
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
                    Requires replenishment
                  </span>
                ) : (
                  <span className="stat-badge-chip success">
                    All items above safety threshold
                  </span>
                )
              }
            />

            {/* Card 3: Scrap Leather Available */}
            <StatCard
              label="Scrap Available"
              value={`${totalAvailableScrapKg.toFixed(2)} kg`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              }
              sub={`${scraps.length} type${scraps.length !== 1 ? "s" : ""} available`}
            />

            {/* Card 4: Active Leather Categories */}
            <StatCard
              label="Leather Types"
              value={`${activeTypesCount} Active`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              }
              sub="Categorized leather grades"
            />
          </StatCards>

          {/* ── Clerk Quick Actions Launcher ──────────── */}
          <div className="clerk-quick-grid">
            <div className="clerk-quick-card" onClick={() => onNavigate("inventory")}>
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap inventory-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                  Operations
                </span>
              </div>
              <h4>Receive & Manage Raw Materials</h4>
              <p>Register incoming leather rolls, adjust counts, and update minimum stock thresholds.</p>
              <span className="clerk-quick-link">Open Inventory Registry →</span>
            </div>

            <div className="clerk-quick-card" onClick={() => onNavigate("scrap")}>
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap scrap-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#D1FAE5", color: "#065F46" }}>
                  Cutting Room
                </span>
              </div>
              <h4>Log Cutting Room Scrap</h4>
              <p>Record off-cut leather weights from the cutting process and manage scrap inventory.</p>
              <span className="clerk-quick-link">Go to Scrap Logging →</span>
            </div>

            <div
              className="clerk-quick-card lookup-card"
              style={{
                cursor: "default",
                overflow: "visible",
                zIndex: quickSearch.trim() ? 50 : 1,
              }}
            >
              <div className="clerk-quick-card-top">
                <div className="clerk-quick-icon-wrap lookup-theme">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <span className="clerk-quick-badge" style={{ background: "#EEF2FF", color: "#3730A3" }}>
                  Quick Lookup
                </span>
              </div>
              <h4>Check Material Stock Level</h4>
              {/* Input wrapper — position:relative so the dropdown floats freely */}
              <div style={{ position: "relative", marginTop: "0.25rem" }}>
                <input
                  type="text"
                  className="clerk-lookup-input"
                  placeholder="Type material name or SKU..."
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  style={{ paddingRight: quickSearch ? "2rem" : "1rem" }}
                />
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                {quickSearch && (
                  <button
                    type="button"
                    onClick={() => setQuickSearch("")}
                    title="Clear search"
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#E5E7EB",
                      border: "none",
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      color: "#6B7280",
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}

                {/* Floating dropdown — position:absolute so it doesn't push grid siblings */}
                {quickSearch.trim() && (
                  <div className="clerk-lookup-results">
                    {searchLoading ? (
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "0.5rem 0.75rem" }}>
                        Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "0.5rem 0.75rem" }}>
                        No matching materials found.
                      </div>
                    ) : (
                      searchResults.map(item => (
                        <div
                          key={item.id}
                          className="clerk-lookup-item"
                          onClick={() => onNavigate("inventory")}
                          title="Click to view in inventory"
                        >
                          <div>
                            <strong style={{ color: "var(--text-dark)" }}>{item.material_name}</strong>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {getSKU(item)} • {item.size || "Standard"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontWeight: 700, color: item.quantity <= item.min_stock ? "#DC2626" : "#059669" }}>
                              {item.quantity} units
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Two-Column Interactive Operations Grid ─── */}
          <div className="clerk-ops-grid">
            {/* Left Column: Visual Distribution + Recent Material Updates */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Leather Stock Distribution Bar Chart */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Leather Stock Distribution
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                    Units by Leather Grade
                  </span>
                </div>

                {chartData.length === 0 ? (
                  <div className="view-empty" style={{ padding: "2rem" }}>
                    No materials currently in inventory.
                  </div>
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
                      <Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={32}>
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Recent Material Activity & Updates */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Recent Material Updates
                  </h3>
                  <button
                    className="clerk-quick-link"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => onNavigate("inventory")}
                  >
                    View All Materials →
                  </button>
                </div>

                {recentUpdates.length === 0 ? (
                  <div className="view-empty" style={{ padding: "1.5rem" }}>
                    No materials registered yet.
                  </div>
                ) : (
                  <div className="clerk-update-list">
                    {recentUpdates.map((item) => (
                      <div key={item.id} className="clerk-update-row">
                        <div className="clerk-update-main">
                          <div className="clerk-update-name">
                            {item.material_name}
                          </div>
                          <div className="clerk-update-meta">
                            <span className="clerk-sku-tag">{getSKU(item)}</span>
                            <span>•</span>
                            <span>{MATERIAL_TYPE_LABELS[item.material_type] || item.material_type}</span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>{item.size}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="clerk-update-right">
                          <div
                            className="clerk-update-qty"
                            style={{
                              color: item.quantity <= item.min_stock ? "var(--text-red)" : "var(--text-dark)",
                            }}
                          >
                            {item.quantity} units
                          </div>
                          <div className="clerk-update-time">
                            {formatTimeElapsed(item.last_update)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Consolidated Stock Health Watchlist & Scrap Snapshot */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Consolidated Stock Health Watchlist (NON-REDUNDANT) */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Stock Health Watchlist
                  </h3>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: lowStockCount > 0 ? "#D97706" : "#059669" }}>
                    {inStockPercent}% Optimal
                  </span>
                </div>

                {/* Visual Stock Health Ratio Track */}
                <div className="health-meter-container">
                  <div className="health-meter-header">
                    <span>Inventory Fulfillment</span>
                    <span>{inStockCount} / {totalMaterials} Items Optimal</span>
                  </div>
                  <div className="health-bar-track">
                    <div
                      className="health-bar-fill-healthy"
                      style={{ width: `${inStockPercent}%` }}
                      title={`Healthy: ${inStockPercent}%`}
                    />
                    <div
                      className="health-bar-fill-low"
                      style={{ width: `${lowStockPercent}%` }}
                      title={`Low Stock: ${lowStockPercent}%`}
                    />
                  </div>
                  <div className="health-legend-row">
                    <div className="health-legend-item">
                      <span className="health-legend-dot" style={{ background: "#10B981" }}></span>
                      <span>Sufficient Stock ({inStockCount})</span>
                    </div>
                    {lowStockCount > 0 && (
                      <div className="health-legend-item">
                        <span className="health-legend-dot" style={{ background: "#F59E0B" }}></span>
                        <span>Needs Reorder ({lowStockCount})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Replenishment List OR Modern Celebratory State */}
                {lowStockItems.length === 0 ? (
                  <div className="clerk-healthy-state">
                    <div className="clerk-healthy-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h4 className="clerk-healthy-title">All Stock In Order</h4>
                    <p className="clerk-healthy-desc">
                      Zero stockouts detected. All raw materials are currently above their minimum inventory safety levels.
                    </p>
                    <button
                      className="clerk-btn-secondary"
                      style={{ marginTop: "0.5rem", fontSize: "0.78rem" }}
                      onClick={() => onNavigate("inventory")}
                    >
                      Browse All Stock Levels
                    </button>
                  </div>
                ) : (
                  <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                    {lowStockItems.map((item) => (
                      <div key={item.id} className="watchlist-item">
                        <div className="watchlist-info">
                          <span className="watchlist-name">{item.material_name}</span>
                          <span className="watchlist-detail">
                            Stock: <strong>{item.quantity}</strong> / Min: {item.min_stock || 10} units
                          </span>
                        </div>
                        <button
                          className="watchlist-action-btn"
                          onClick={() => onNavigate("inventory")}
                          title="Restock this material"
                        >
                          Restock →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scrap Storage Snapshot */}
              <div className="clerk-ops-panel">
                <div className="clerk-ops-panel-header">
                  <h3 className="clerk-ops-panel-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Scrap Inventory Snapshot
                  </h3>
                  <button
                    className="clerk-quick-link"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => onNavigate("scrap")}
                  >
                    View All Scrap →
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem", background: "#F0FDF4", borderRadius: "8px", border: "1px solid #BBF7D0", marginBottom: "0.85rem" }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "#166534", fontWeight: 600, textTransform: "uppercase" }}>
                      Ready for Sorting / Sale
                    </div>
                    <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", fontWeight: 800, color: "#14532D" }}>
                      {totalAvailableScrapKg.toFixed(2)} kg
                    </div>
                  </div>
                  <button
                    className="clerk-btn-primary"
                    style={{ padding: "0.45rem 0.85rem", fontSize: "0.75rem" }}
                    onClick={() => onNavigate("scrap")}
                  >
                    + Log Scrap
                  </button>
                </div>

                {scraps.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    No scrap types configured.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    {scraps.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.5rem 0.65rem",
                          background: "#FAFAFA",
                          borderRadius: "6px",
                          fontSize: "0.78rem",
                          border: "1px solid #F0F0F0",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "var(--text-dark)" }}>
                          {t.name}
                        </span>
                        <span style={{ fontWeight: 700, color: "#059669" }}>
                          {Number(t.available_kg).toFixed(2)} kg · ₱{Number(t.price_per_kg).toLocaleString("en-PH")}/kg
                        </span>
                      </div>
                    ))}
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
      default:
        return <EmployeeHomeView onNavigate={setActiveNav} fullName={fullName} />;
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
