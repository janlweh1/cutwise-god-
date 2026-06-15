import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../../lib/api";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ── Constants ───────────────────────────────── */

const ACTION_COLORS = {
  material_added:   "#059669",
  material_updated: "#2563EB",
  material_deleted: "#DC2626",
  scrap_recorded:   "#D97706",
  scrap_sold:       "#7C3AED",
  stock_adjusted:   "#0891B2",
  supplier_added:   "#059669",
  config_updated:   "#111827",
};

const CHART_COLORS = [
  "#7B1F1F", "#C9252C", "#D4956A", "#E8B89D",
  "#9CA3AF", "#6B7280", "#4B5563", "#A16207",
  "#059669", "#2563EB", "#7C3AED",
];

const MATERIAL_TYPE_LABELS = {
  cowhide: "Cowhide", goatskin: "Goatskin", sheepskin: "Sheepskin",
  suede: "Suede", nappa: "Nappa Leather", synthetic: "Synthetic Leather",
  rubber: "Rubber", thread: "Thread", adhesive: "Adhesive",
  accessory: "Accessory", other: "Other",
};

const fmt = (n, dec = 2) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

/* ── PDF Report Generator ───────────────────── */

const generatePDF = async ({ materials, suppliers, scraps, chartRef }) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  /* ── Branding header ── */
  doc.setFillColor(123, 31, 31);
  doc.rect(0, 0, pageWidth, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("CUTWISE INVENTORY MANAGEMENT", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 200, 200);
  doc.text("System Inventory Report", margin, 22);

  const now = new Date();
  const genDate = now.toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const genTime = now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  doc.text(`Generated: ${genDate} at ${genTime}`, pageWidth - margin, 22, { align: "right" });

  y = 42;

  /* ── Computed summary figures ── */
  const totalQty   = materials.reduce((s, m) => s + m.quantity, 0);
  const totalValue = materials.reduce((s, m) => s + Number(m.total_value || 0), 0);
  const lowStock   = materials.filter(m => m.stock_status === "low_stock" || m.stock_status === "out_of_stock");
  const availScrap = scraps.filter(s => s.status === "available");
  const totalScrapKg = availScrap.reduce((s, sc) => s + Number(sc.weight_kg), 0);

  /* ── Section: Summary Metrics ── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("SUMMARY OVERVIEW", margin, y);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const summaryCards = [
    { label: "Total Raw Materials",    value: totalQty.toLocaleString() + " units" },
    { label: "Overall Inventory Value", value: "₱" + fmt(totalValue) },
    { label: "Available Scrap Weight",  value: totalScrapKg.toFixed(3) + " kg" },
    { label: "Active Suppliers",        value: suppliers.length.toString() },
    { label: "Low Stock Alerts",        value: lowStock.length.toString() },
    { label: "Total Materials Types",   value: [...new Set(materials.map(m => m.material_type))].length.toString() },
  ];

  const cardCols = 3;
  const cardW = (pageWidth - margin * 2 - 4 * (cardCols - 1)) / cardCols;
  summaryCards.forEach((card, i) => {
    const col = i % cardCols;
    const row = Math.floor(i / cardCols);
    const cx = margin + col * (cardW + 4);
    const cy = y + row * 22;

    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(cx, cy, cardW, 18, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(card.label.toUpperCase(), cx + 4, cy + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(card.value, cx + 4, cy + 14);
  });

  y += Math.ceil(summaryCards.length / cardCols) * 22 + 12;

  /* ── Section: Inventory Distribution Chart ── */
  if (chartRef && chartRef.current) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text("INVENTORY DISTRIBUTION", margin, y);
    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const chartH = 70;
      const chartW = pageWidth - margin * 2;
      doc.addImage(imgData, "PNG", margin, y, chartW, chartH);
      y += chartH + 10;
    } catch {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("(Chart could not be rendered)", margin, y + 6);
      y += 14;
    }
  }

  /* ── Check page space ── */
  const checkPage = (needed = 40) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin + 10;
    }
  };

  /* ── Section: Low Stock Items ── */
  checkPage(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("LOW STOCK ITEMS — NEEDS RESTOCKING", margin, y);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  if (lowStock.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("✓ All materials are adequately stocked.", margin, y + 6);
    y += 14;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Material Name", "Type", "Current Stock", "Min Stock", "Unit Cost (₱)", "Status"]],
      body: lowStock.map(m => [
        m.material_name,
        MATERIAL_TYPE_LABELS[m.material_type] || m.material_type,
        m.quantity,
        m.min_stock,
        fmt(m.unit_cost),
        m.stock_status === "out_of_stock" ? "OUT OF STOCK" : "LOW STOCK",
      ]),
      headStyles: {
        fillColor: [123, 31, 31],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "right" },
        5: {
          fontStyle: "bold",
          textColor: [185, 28, 28],
        },
      },
      didDrawPage: (data) => { y = data.cursor.y; },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  /* ── Section: Full Materials List ── */
  checkPage(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("RAW MATERIALS INVENTORY", margin, y);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Material", "Type", "Supplier", "Qty", "Unit Cost (₱)", "Total Value (₱)", "Status"]],
    body: materials.map(m => [
      m.material_name,
      MATERIAL_TYPE_LABELS[m.material_type] || m.material_type,
      m.supplier_name || "—",
      m.quantity,
      fmt(m.unit_cost),
      fmt(m.total_value),
      m.stock_status === "in_stock" ? "In Stock"
        : m.stock_status === "low_stock" ? "Low Stock"
        : "Out of Stock",
    ]),
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      3: { halign: "center" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const val = data.cell.raw;
        if (val === "Out of Stock") data.cell.styles.textColor = [185, 28, 28];
        else if (val === "Low Stock") data.cell.styles.textColor = [180, 83, 9];
        else data.cell.styles.textColor = [5, 150, 105];
      }
    },
    didDrawPage: (data) => { y = data.cursor.y; },
  });
  y = doc.lastAutoTable.finalY + 10;

  /* ── Section: Scrap Summary ── */
  checkPage(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("SCRAP INVENTORY SUMMARY", margin, y);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Source Material", "Weight (kg)", "Date Recorded", "Status"]],
    body: scraps.map(s => [
      s.material_name,
      Number(s.weight_kg).toFixed(3),
      new Date(s.recorded_date).toLocaleDateString("en-PH"),
      s.status === "available" ? "Available" : "Sold",
    ]),
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "center" },
      3: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        data.cell.styles.textColor =
          data.cell.raw === "Available" ? [5, 150, 105] : [107, 114, 128];
      }
    },
    didDrawPage: (data) => { y = data.cursor.y; },
  });
  y = doc.lastAutoTable.finalY + 10;

  /* ── Section: Suppliers ── */
  checkPage(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text("ACTIVE SUPPLIERS", margin, y);
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Supplier Name", "Contact Person", "Phone", "Email", "Materials"]],
    body: suppliers.map(s => [
      s.name,
      s.contact_person || "—",
      s.phone || "—",
      s.email || "—",
      s.material_count || 0,
    ]),
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 4: { halign: "center" } },
    didDrawPage: (data) => { y = data.cursor.y; },
  });

  /* ── Footer on every page ── */
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(245, 245, 245);
    doc.rect(0, ph - 12, pageWidth, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text("CUTWISE Inventory Management System — Confidential", margin, ph - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, ph - 5, { align: "right" });
  }

  /* ── Save ── */
  const filename = `CUTWISE_Report_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};

/* ══════════════════════════════════════════════
   ReportsView — Main Component
   ══════════════════════════════════════════════ */

export const ReportsView = () => {
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [userFilter, setUserFilter]   = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter]   = useState("");
  const [allUsers, setAllUsers]       = useState([]);
  const [generating, setGenerating]   = useState(false);

  // Report data — fetched lazily when generating
  const [reportData, setReportData]   = useState(null);
  const chartRef = useRef(null);

  /* ── Fetch audit log users for dropdown ── */
  useEffect(() => {
    const fetchUsersList = async () => {
      try {
        const res = await api.get("/inventory/logs/");
        const data = res.data.results || res.data;
        const users = [...new Set(data.map((log) => log.username).filter(Boolean))];
        setAllUsers(users);
      } catch (err) {
        console.error("Failed to fetch users list:", err);
      }
    };
    fetchUsersList();
  }, []);

  /* ── Fetch audit logs ── */
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search   = search;
      if (userFilter)   params.username = userFilter;
      if (actionFilter) params.action   = actionFilter;
      if (dateFilter)   params.date     = dateFilter;
      const res = await api.get("/inventory/logs/", { params });
      setLogs(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search, userFilter, actionFilter, dateFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  /* ── Fetch all report data + generate PDF ── */
  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const [resMat, resSuppliers, resScraps] = await Promise.all([
        api.get("/inventory/materials/"),
        api.get("/inventory/suppliers/"),
        api.get("/inventory/scrap/"),
      ]);
      const materials  = resMat.data.results      || resMat.data;
      const suppliers  = resSuppliers.data.results || resSuppliers.data;
      const scraps     = resScraps.data.results    || resScraps.data;

      setReportData({ materials, suppliers, scraps });

      // Wait one tick for the hidden chart to render, then generate PDF
      setTimeout(async () => {
        await generatePDF({ materials, suppliers, scraps, chartRef });
        setGenerating(false);
      }, 600);
    } catch (err) {
      console.error("Failed to generate report:", err);
      setGenerating(false);
    }
  };

  /* ── Build donut data for the hidden chart ── */
  const donutData = reportData
    ? Object.entries(
        reportData.materials.reduce((acc, m) => {
          const label = MATERIAL_TYPE_LABELS[m.material_type] || m.material_type || "Other";
          acc[label] = (acc[label] || 0) + m.quantity;
          return acc;
        }, {})
      )
        .map(([name, value]) => ({ name, value }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="view-container">

      {/* ── Header ── */}
      <div className="view-header">
        <h2 className="view-title">Audit Trail</h2>
        <button
          id="generate-report-btn"
          className="btn btn-primary"
          onClick={handleGenerateReport}
          disabled={generating}
          style={{ gap: "0.5rem" }}
        >
          {generating ? (
            <>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Report (PDF)
            </>
          )}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="view-filters" style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <input
          type="text"
          className="filter-input"
          style={{ flex: "1 1 200px" }}
          placeholder="Search details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-input"
          style={{ flex: "1 1 150px" }}
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">All Users</option>
          {allUsers.map((user) => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
        <select
          className="filter-input"
          style={{ flex: "1 1 150px" }}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="material_added">Material Added</option>
          <option value="material_updated">Material Updated</option>
          <option value="material_deleted">Material Deleted</option>
          <option value="scrap_recorded">Scrap Recorded</option>
          <option value="scrap_sold">Scrap Sold</option>
          <option value="stock_adjusted">Stock Adjusted</option>
          <option value="supplier_added">Supplier Added</option>
          <option value="config_updated">Configuration Updated</option>
        </select>
        <input
          type="date"
          className="filter-input"
          style={{ flex: "1 1 150px" }}
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        {(search || userFilter || actionFilter || dateFilter) && (
          <button
            className="btn btn-secondary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
            onClick={() => { setSearch(""); setUserFilter(""); setActionFilter(""); setDateFilter(""); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Audit Log Table ── */}
      {loading ? (
        <div className="view-loading">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="view-empty">No audit records found.</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table" id="audit-log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="td-muted">
                    {new Date(log.timestamp).toLocaleString("en-PH", {
                      year: "numeric", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="td-bold">{log.username || "System"}</td>
                  <td>
                    <span
                      className="action-badge"
                      style={{
                        backgroundColor: ACTION_COLORS[log.action] || "#6B7280",
                        color: "#fff",
                      }}
                    >
                      {log.action_display || log.action}
                    </span>
                  </td>
                  <td>{log.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Hidden chart used for PDF snapshot ── */}
      {reportData && donutData.length > 0 && (
        <div
          ref={chartRef}
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "700px",
            height: "320px",
            background: "#fff",
            padding: "12px",
          }}
          aria-hidden="true"
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={donutData}
                cx="40%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} units`, name]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={10}
                formatter={(val) => (
                  <span style={{ fontSize: "12px", color: "#374151" }}>{val}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Spin keyframe ── */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ReportsView;
