import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../../lib/api";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

/* ── Constants ───────────────────────────────── */

const ACTION_COLORS = {
  material_added: "#059669",
  material_updated: "#2563EB",
  material_deleted: "#DC2626",
  scrap_recorded: "#D97706",
  scrap_sold: "#7C3AED",
  stock_adjusted: "#0891B2",
  supplier_added: "#059669",
  config_updated: "#111827",
};

const CHART_COLORS = [
  "#7B1F1F", "#C9252C", "#D4956A", "#E8B89D",
  "#9CA3AF", "#6B7280", "#4B5563", "#A16207",
  "#059669", "#2563EB", "#7C3AED",
];

const MATERIAL_TYPE_LABELS = {
  cowhide: "Cowhide", goatskin: "Goatskin", sheepskin: "Sheepskin",
  suede: "Suede", nappa: "Nappa Leather", synthetic: "Synthetic Leather",
  other: "Other",
};

const fmt = (n, dec = 2) =>
  Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

/* ── Excel Report Generator ──────────────────── */

const generateExcel = ({ materials, suppliers, scraps, dateFrom, dateTo, timeFrom, timeTo }) => {
  const wb = XLSX.utils.book_new();

  const fromLabel = dateFrom ? `${dateFrom}${timeFrom ? " " + timeFrom : ""}` : "All";
  const toLabel   = dateTo   ? `${dateTo}${timeTo   ? " " + timeTo   : ""}` : "All";
  const rangeLabel = (dateFrom || dateTo || timeFrom || timeTo)
    ? `${fromLabel} → ${toLabel}`
    : "All Dates";

  const MATERIAL_TYPE_LABELS_LOCAL = {
    cowhide: "Cowhide", goatskin: "Goatskin", sheepskin: "Sheepskin",
    suede: "Suede", nappa: "Nappa Leather", synthetic: "Synthetic Leather",
    other: "Other",
  };

  /* Sheet 1 – Raw Materials (all) */
  const matData = [
    ["CUTWISE INVENTORY MANAGEMENT — RAW MATERIALS"],
    [`Date Range: ${rangeLabel}`],
    [],
    ["Material Name", "Type", "Supplier", "Qty", "Unit Cost (₱)", "Total Value (₱)", "Min Stock", "Stock Status"],
    ...materials.map(m => [
      m.material_name,
      MATERIAL_TYPE_LABELS_LOCAL[m.material_type] || m.material_type,
      m.supplier_name || "—",
      m.quantity,
      Number(m.unit_cost || 0),
      Number(m.total_value || 0),
      m.min_stock,
      m.stock_status === "in_stock" ? "In Stock"
        : m.stock_status === "low_stock" ? "Low Stock"
          : "Out of Stock",
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(matData);
  ws1["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Raw Materials");

  /* Sheet 2 – Low Stock Items */
  const lowStock = materials.filter(m => m.stock_status === "low_stock" || m.stock_status === "out_of_stock");
  const lowData = [
    ["LOW STOCK MATERIALS — NEEDS RESTOCKING"],
    [],
    ["Material Name", "Type", "Current Stock", "Min Stock", "Unit Cost (₱)", "Status"],
    ...lowStock.map(m => [
      m.material_name,
      MATERIAL_TYPE_LABELS_LOCAL[m.material_type] || m.material_type,
      m.quantity,
      m.min_stock,
      Number(m.unit_cost || 0),
      m.stock_status === "out_of_stock" ? "OUT OF STOCK" : "LOW STOCK",
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(lowData);
  ws2["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Low Stock");

  /* Sheet 3 – Scrap Summary */
  const scrapData = [
    ["SCRAP INVENTORY SUMMARY"],
    [],
    ["Source Material", "Weight (kg)", "Date Recorded", "Status"],
    ...scraps.map(s => [
      s.material_name,
      Number(s.weight_kg),
      new Date(s.recorded_date).toLocaleDateString("en-PH"),
      s.status === "available" ? "Available" : "Sold",
    ]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(scrapData);
  ws3["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Scrap Summary");

  /* Sheet 4 – Suppliers */
  const supplierData = [
    ["ACTIVE SUPPLIERS"],
    [],
    ["Supplier Name", "Contact Person", "Phone", "Email", "Materials"],
    ...suppliers.map(s => [
      s.name,
      s.contact_person || "—",
      s.phone || "—",
      s.email || "—",
      s.material_count || 0,
    ]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(supplierData);
  ws4["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Suppliers");

  const now = new Date();
  const filename = `CUTWISE_Report_${now.toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

/* ── PDF Report Generator ───────────────────── */

const generatePDF = async ({ materials, suppliers, scraps, chartRef, dateFrom, dateTo, timeFrom, timeTo }) => {
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

  /* ── Date range label ── */
  if (dateFrom || dateTo) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(230, 210, 210);
    const fromLabel = dateFrom ? `${dateFrom}${timeFrom ? " " + timeFrom : ""}` : "All";
    const toLabel   = dateTo   ? `${dateTo}${timeTo   ? " " + timeTo   : ""}` : "All";
    const rangeLabel = `Data range: ${fromLabel} → ${toLabel}`;
    doc.text(rangeLabel, margin, 28);
  }

  y = 42;

  /* ── Computed summary figures ── */
  const totalQty = materials.reduce((s, m) => s + m.quantity, 0);
  const totalValue = materials.reduce((s, m) => s + Number(m.total_value || 0), 0);
  const lowStock = materials.filter(m => m.stock_status === "low_stock" || m.stock_status === "out_of_stock");
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
    { label: "Total Raw Materials", value: totalQty.toLocaleString() + " units" },
    { label: "Overall Inventory Value", value: "₱" + fmt(totalValue) },
    { label: "Available Scrap Weight", value: totalScrapKg.toFixed(3) + " kg" },
    { label: "Active Suppliers", value: suppliers.length.toString() },
    { label: "Low Stock Alerts", value: lowStock.length.toString() },
    { label: "Total Materials Types", value: [...new Set(materials.map(m => m.material_type))].length.toString() },
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

  /* ── Return blob URL to caller ── */
  const blobUrl = doc.output("bloburl");
  return blobUrl;
};

/* ══════════════════════════════════════════════
   ReportsView — Main Component
   ══════════════════════════════════════════════ */

export const ReportsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Report data — fetched lazily when generating
  const [reportData, setReportData] = useState(null);
  const chartRef = useRef(null);

  /* ── Reset page on filter changes ── */
  useEffect(() => {
    setPage(1);
  }, [search, userFilter, actionFilter, dateFilter]);

  /* ── Fetch audit log users for dropdown ── */
  useEffect(() => {
    const fetchUsersList = async () => {
      try {
        const res = await api.get("/inventory/logs/", { params: { page_size: 100 } });
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
      const params = { page };
      if (search) params.search = search;
      if (userFilter) params.username = userFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateFilter) params.date = dateFilter;
      const res = await api.get("/inventory/logs/", { params });
      if (res.data.results) {
        setLogs(res.data.results);
        setTotalCount(res.data.count || 0);
      } else {
        setLogs(res.data);
        setTotalCount(res.data.length || 0);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, userFilter, actionFilter, dateFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo,   setReportDateTo]   = useState("");
  const [reportTimeFrom, setReportTimeFrom] = useState("");
  const [reportTimeTo,   setReportTimeTo]   = useState("");
  const [generatingExcel, setGeneratingExcel] = useState(false);

  /* ── Fetch all report data + generate PDF ── */
  const buildReportParams = () => {
    const p = {};
    if (reportDateFrom) p.date_from = reportDateFrom;
    if (reportDateTo)   p.date_to   = reportDateTo;
    if (reportTimeFrom) p.time_from = reportTimeFrom;
    if (reportTimeTo)   p.time_to   = reportTimeTo;
    return p;
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    // Open the tab immediately (synchronous) so popup blockers don't block it
    const previewTab = window.open("", "_blank");
    if (previewTab) {
      previewTab.document.write(
        "<html><head><title>Generating Report…</title></head><body style='font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb'>" +
        "<p style='color:#6b7280;font-size:1.1rem'>⏳ Generating your report, please wait…</p></body></html>"
      );
    }
    try {
      const params = buildReportParams();
      const [resMat, resSuppliers, resScraps] = await Promise.all([
        api.get("/inventory/materials/", { params }),
        api.get("/inventory/suppliers/"),
        api.get("/inventory/scrap/", { params }),
      ]);
      const materials = resMat.data.results || resMat.data;
      const suppliers = resSuppliers.data.results || resSuppliers.data;
      const scraps = resScraps.data.results || resScraps.data;

      setReportData({ materials, suppliers, scraps });

      setTimeout(async () => {
        const blobUrl = await generatePDF({
          materials, suppliers, scraps, chartRef,
          dateFrom: reportDateFrom, dateTo: reportDateTo,
          timeFrom: reportTimeFrom, timeTo: reportTimeTo,
        });
        if (previewTab && blobUrl) {
          previewTab.location.href = blobUrl;
        } else if (blobUrl) {
          window.open(blobUrl, "_blank");
        }
        setGenerating(false);
      }, 600);
    } catch (err) {
      console.error("Failed to generate report:", err);
      if (previewTab) previewTab.close();
      setGenerating(false);
    }
  };


  const handleGenerateExcel = async () => {
    setGeneratingExcel(true);
    try {
      const params = buildReportParams();
      const [resMat, resSuppliers, resScraps] = await Promise.all([
        api.get("/inventory/materials/", { params }),
        api.get("/inventory/suppliers/"),
        api.get("/inventory/scrap/", { params }),
      ]);
      const materials = resMat.data.results || resMat.data;
      const suppliers = resSuppliers.data.results || resSuppliers.data;
      const scraps = resScraps.data.results || resScraps.data;
      generateExcel({
        materials, suppliers, scraps,
        dateFrom: reportDateFrom, dateTo: reportDateTo,
        timeFrom: reportTimeFrom, timeTo: reportTimeTo,
      });
    } catch (err) {
      console.error("Failed to generate Excel:", err);
    } finally {
      setGeneratingExcel(false);
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
      <div className="view-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <h2 className="view-title">Audit Logs</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            id="generate-report-btn"
            className="btn btn-primary"
            onClick={handleGenerateReport}
            disabled={generating || generatingExcel}
            style={{ gap: "0.5rem" }}
          >
            {generating ? (
              <>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export PDF
              </>
            )}
          </button>
          <button
            id="generate-excel-btn"
            className="btn btn-secondary"
            onClick={handleGenerateExcel}
            disabled={generating || generatingExcel}
            style={{ gap: "0.5rem", borderColor: "#059669", color: "#059669" }}
          >
            {generatingExcel ? (
              <>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Export Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Date-Time Range Picker Card ── */}
      <div style={{
        background: "linear-gradient(135deg, #7B1F1F 0%, #9B2C2C 100%)",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        marginBottom: "1.5rem",
        boxShadow: "0 4px 20px rgba(123,31,31,0.18)",
        display: "flex",
        flexWrap: "wrap",
        gap: "1.25rem",
        alignItems: "flex-end",
      }}>
        <div style={{ flex: "0 0 auto" }}>
          <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            📅 Report Date &amp; Time Range
          </p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>
            Leave blank to export all records
          </p>
        </div>

        {/* FROM */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em", textTransform: "uppercase" }}>From</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="date"
              id="report-date-from"
              value={reportDateFrom}
              onChange={(e) => setReportDateFrom(e.target.value)}
              style={{
                padding: "0.45rem 0.7rem", fontSize: "0.85rem",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                colorScheme: "dark",
                outline: "none",
              }}
            />
            <input
              type="time"
              id="report-time-from"
              value={reportTimeFrom}
              onChange={(e) => setReportTimeFrom(e.target.value)}
              style={{
                padding: "0.45rem 0.7rem", fontSize: "0.85rem",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                colorScheme: "dark",
                outline: "none",
                width: "110px",
              }}
            />
          </div>
        </div>

        {/* Arrow */}
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "1.2rem", paddingBottom: "0.2rem" }}>→</div>

        {/* TO */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em", textTransform: "uppercase" }}>To</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="date"
              id="report-date-to"
              value={reportDateTo}
              onChange={(e) => setReportDateTo(e.target.value)}
              style={{
                padding: "0.45rem 0.7rem", fontSize: "0.85rem",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                colorScheme: "dark",
                outline: "none",
              }}
            />
            <input
              type="time"
              id="report-time-to"
              value={reportTimeTo}
              onChange={(e) => setReportTimeTo(e.target.value)}
              style={{
                padding: "0.45rem 0.7rem", fontSize: "0.85rem",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                colorScheme: "dark",
                outline: "none",
                width: "110px",
              }}
            />
          </div>
        </div>

        {/* Active range preview */}
        {(reportDateFrom || reportDateTo || reportTimeFrom || reportTimeTo) && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "rgba(255,255,255,0.12)",
            borderRadius: "8px", padding: "0.4rem 0.9rem",
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
              {reportDateFrom || "All"}{reportTimeFrom ? ` ${reportTimeFrom}` : ""}
              {" → "}
              {reportDateTo || "All"}{reportTimeTo ? ` ${reportTimeTo}` : ""}
            </span>
            <button
              onClick={() => { setReportDateFrom(""); setReportDateTo(""); setReportTimeFrom(""); setReportTimeTo(""); }}
              title="Clear date-time range"
              style={{
                background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%",
                width: "20px", height: "20px", cursor: "pointer", color: "#fff",
                fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
              }}
            >✕</button>
          </div>
        )}
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
        <>
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

          {/* Pagination Controls */}
          <div className="pagination-controls" style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "#fff",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            boxShadow: "var(--shadow-sm)",
          }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              Previous
            </button>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
              Page {page} of {Math.ceil(totalCount / 30) || 1}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 30 >= totalCount}
              style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", cursor: page * 30 >= totalCount ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </>
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
            <BarChart
              data={donutData}
              margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6B7280", fontSize: 11 }}
                axisLine={{ stroke: "#E5E7EB" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [`${value} units`, name]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                {donutData.map((_, idx) => (
                  <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Spin keyframe ── */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ReportsView;
