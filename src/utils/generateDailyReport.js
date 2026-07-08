/**
 * generateDailyReport.js
 * 
 * Generates a professionally formatted PDF report matching the
 * "Daily Operations Report - Stratizen Cafeteria" Stitch design.
 * 
 * Uses jsPDF + jspdf-autotable for PDF generation.
 * All data is sourced from live Supabase queries.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";

/* ── Design Tokens (from Stitch) ──────────────────────────── */
const COLORS = {
  primary:              [0, 30, 64],       // #001E40
  primaryContainer:     [0, 51, 102],      // #003366
  onPrimary:            [255, 255, 255],
  onSurface:            [28, 27, 27],      // #1c1b1b
  onSurfaceVariant:     [67, 71, 79],      // #43474f
  surfaceContainerLow:  [246, 243, 242],   // #F6F3F2
  surfaceContainer:     [240, 237, 237],   // #F0EDED
  outlineVariant:       [195, 198, 209],   // #C3C6D1
  secondary:            [27, 109, 36],     // #1b6d24
  secondaryContainer:   [160, 243, 153],   // #A0F399
  onSecondaryContainer: [33, 113, 40],     // #217128
  white:                [255, 255, 255],
  error:                [186, 26, 26],     // #BA1A1A
};

const FONT_SIZES = {
  headlineLg: 24,
  titleLg:    16,
  bodyLg:     12,
  bodyMd:     10,
  labelLg:    10,
  labelMd:    8,
};

/* Page dimensions (A4 portrait in mm) */
const PAGE = {
  width:  210,
  height: 297,
  marginX: 20,
  marginY: 20,
};

const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

/* ── Helpers ───────────────────────────────────────────────── */

const formatKES = (n) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatTime12 = (isoString) => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "—";
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const getReportFilename = () => {
  const now = new Date();
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const day = now.getDate().toString().padStart(2, "0");
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hStr = hours.toString().padStart(2, "0");
  return `Report for ${day} ${month} ${year} at ${hStr}-${minutes} ${ampm}.pdf`;
};

const getFormattedDate = () => {
  const now = new Date();
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
};

const getFormattedTime = () => {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

/* ── Data Fetcher ──────────────────────────────────────────── */

async function fetchReportData(role) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTime = todayStart.getTime();

  let completedOrders = [];
  if (role === "admin") {
    const { data: ordersData, error: ordersError } = await supabase
      .rpc("admin_get_all_orders");
    if (ordersError) throw ordersError;

    const { data: itemsData, error: itemsError } = await supabase
      .rpc("admin_get_all_order_items");
    if (itemsError) throw itemsError;

    const itemsMap = {};
    (itemsData || []).forEach(item => {
      if (!itemsMap[item.order_id]) {
        itemsMap[item.order_id] = [];
      }
      itemsMap[item.order_id].push({
        quantity: item.quantity,
        menu: {
          id: item.menu_item_id,
          name: item.menu_name || "Meal"
        }
      });
    });

    completedOrders = (ordersData || [])
      .filter(o => o.status === "collected" && new Date(o.collected_at || o.created_at).getTime() >= todayTime)
      .map(o => ({
        ...o,
        order_items: itemsMap[o.id] || []
      }));
  } else {
    const todayStr = todayStart.toISOString();
    const { data: ordersData, error } = await supabase
      .from("orders")
      .select("*, order_items(*, menu(*))")
      .eq("status", "collected")
      .gte("collected_at", todayStr)
      .order("collected_at", { ascending: true });

    if (error) throw new Error("Failed to fetch orders: " + error.message);
    completedOrders = ordersData || [];
  }

  const orders = completedOrders;

  /* Stats */
  const totalOrders = orders.length;
  let totalRevenue = 0;
  let totalPrepMins = 0;
  let prepCount = 0;

  const tableRows = orders.map((o) => {
    const total = parseFloat(o.total || o.total_price || 0);
    totalRevenue += total;

    if (o.prep_started_at && o.ready_at) {
      const mins = (new Date(o.ready_at) - new Date(o.prep_started_at)) / 60000;
      if (mins > 0) {
        totalPrepMins += mins;
        prepCount++;
      }
    }

    const items = (o.order_items || [])
      .map((oi) => {
        const name = oi.menu?.name || "Meal";
        return oi.quantity > 1 ? `${name} (x${oi.quantity})` : name;
      })
      .join(", ");

    return {
      orderId: `#STR-${o.id.substring(0, 8).toUpperCase()}`,
      studentName: o.student_name || "Student",
      items,
      completionTime: formatTime12(o.collected_at),
      amount: formatKES(total),
      method: "Wallet",
    };
  });

  const avgPrepRaw = prepCount > 0 ? totalPrepMins / prepCount : 0;
  const avgPrepMins = Math.floor(avgPrepRaw);
  const avgPrepSecs = Math.round((avgPrepRaw - avgPrepMins) * 60);

  return {
    totalOrders,
    totalRevenue,
    avgPrep: avgPrepMins > 0 || avgPrepSecs > 0
      ? `${avgPrepMins}m ${avgPrepSecs.toString().padStart(2, "0")}s`
      : "—",
    tableRows,
    reportDate: getFormattedDate(),
    reportTime: getFormattedTime(),
  };
}

/* ── PDF Builder ───────────────────────────────────────────── */

function drawRestaurantIcon(doc, x, y, size) {
  /* Simple restaurant icon placeholder using shapes */
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  doc.setFillColor(...COLORS.primary);
  doc.circle(cx, cy, r, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(size * 0.5);
  doc.setFont("helvetica", "bold");
  doc.text("S", cx, cy + size * 0.15, { align: "center" });
}

function drawKPICard(doc, x, y, width, icon, label, value) {
  const cardH = 28;

  /* Card background */
  doc.setFillColor(...COLORS.surfaceContainerLow);
  doc.setDrawColor(...COLORS.outlineVariant);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, cardH, 3, 3, "FD");

  /* Icon circle */
  doc.setFillColor(...COLORS.primary);
  doc.circle(x + 9, y + cardH / 2, 4.5, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text(icon, x + 9, y + cardH / 2 + 1.8, { align: "center" });

  /* Label */
  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.labelMd);
  doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), x + 18, y + 10);

  /* Value */
  doc.setTextColor(...COLORS.onSurface);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 18, y + 20);
}

function buildPDF(data) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let cursorY = PAGE.marginY;

  /* ─── HEADER ─────────────────────────────────────────────── */

  /* Left: Icon + Title */
  drawRestaurantIcon(doc, PAGE.marginX, cursorY, 10);
  
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONT_SIZES.headlineLg);
  doc.setFont("helvetica", "bold");
  doc.text("Daily Operations Report", PAGE.marginX + 14, cursorY + 7.5);

  /* Right: Stratizen Cafeteria branding */
  drawRestaurantIcon(doc, PAGE.width - PAGE.marginX - 10, cursorY - 2, 12);

  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.labelMd);
  doc.setFont("helvetica", "bold");
  doc.text("STRATIZEN CAFETERIA", PAGE.width - PAGE.marginX, cursorY + 15, { align: "right" });

  cursorY += 14;

  /* Subtitle: Date + Time */
  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.bodyMd);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Date: ${data.reportDate}  |  Generated at ${data.reportTime}`,
    PAGE.marginX,
    cursorY
  );

  cursorY += 6;

  /* Badge: "Official Audit Copy" */
  const badgeText = "Official Audit Copy";
  doc.setFontSize(FONT_SIZES.labelMd);
  const badgeW = doc.getTextWidth(badgeText) + 6;
  doc.setFillColor(...COLORS.secondaryContainer);
  doc.roundedRect(PAGE.marginX, cursorY - 3, badgeW, 6, 3, 3, "F");
  doc.setTextColor(...COLORS.onSecondaryContainer);
  doc.setFont("helvetica", "bold");
  doc.text(badgeText, PAGE.marginX + 3, cursorY + 0.5);

  cursorY += 8;

  /* Divider */
  doc.setDrawColor(...COLORS.outlineVariant);
  doc.setLineWidth(0.4);
  doc.line(PAGE.marginX, cursorY, PAGE.width - PAGE.marginX, cursorY);

  cursorY += 8;

  /* ─── KPI SUMMARY CARDS ──────────────────────────────────── */
  const cardGap = 4;
  const cardW = (CONTENT_WIDTH - cardGap * 2) / 3;

  drawKPICard(doc, PAGE.marginX, cursorY, cardW, "≡", "TOTAL ORDERS", `${data.totalOrders} Orders`);
  drawKPICard(doc, PAGE.marginX + cardW + cardGap, cursorY, cardW, "$", "TOTAL REVENUE (KES)", formatKES(data.totalRevenue));
  drawKPICard(doc, PAGE.marginX + (cardW + cardGap) * 2, cursorY, cardW, "⏱", "AVG. PREP", data.avgPrep);

  cursorY += 36;

  /* ─── DETAILED TRANSACTIONS TABLE ────────────────────────── */
  doc.setTextColor(...COLORS.onSurface);
  doc.setFontSize(FONT_SIZES.titleLg);
  doc.setFont("helvetica", "bold");
  doc.text("Detailed Transactions", PAGE.marginX, cursorY);

  cursorY += 6;

  if (data.tableRows.length === 0) {
    doc.setTextColor(...COLORS.onSurfaceVariant);
    doc.setFontSize(FONT_SIZES.bodyMd);
    doc.setFont("helvetica", "italic");
    doc.text("No completed orders recorded today.", PAGE.marginX, cursorY + 6);
    cursorY += 14;
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: PAGE.marginX, right: PAGE.marginX },
      head: [["Order ID", "Student Name", "Items", "Completion", "Amount (KES)", "Method"]],
      body: data.tableRows.map((r) => [
        r.orderId,
        r.studentName,
        r.items,
        r.completionTime,
        r.amount,
        r.method,
      ]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        lineColor: [...COLORS.outlineVariant],
        lineWidth: 0.3,
        textColor: COLORS.onSurface,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: COLORS.surfaceContainer,
        textColor: COLORS.onSurfaceVariant,
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: COLORS.primary, cellWidth: 26 },
        1: { cellWidth: 30 },
        2: { fontStyle: "italic", textColor: COLORS.onSurfaceVariant, cellWidth: "auto" },
        3: { halign: "center", cellWidth: 22 },
        4: { halign: "right", fontStyle: "bold", cellWidth: 24 },
        5: { cellWidth: 18 },
      },
      alternateRowStyles: {
        fillColor: [252, 249, 248],
      },
      tableLineColor: COLORS.outlineVariant,
      tableLineWidth: 0.3,
      didDrawPage: (hookData) => {
        /* Footer on every page */
        drawFooter(doc, hookData.pageNumber, hookData.pageCount);
      },
    });
  }

  /* ─── FOOTER (on last page if table didn't trigger it) ──── */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount);
  }

  return doc;
}

function drawFooter(doc, pageNum, totalPages) {
  const footerY = PAGE.height - PAGE.marginY;

  /* Divider */
  doc.setDrawColor(...COLORS.outlineVariant);
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginX, footerY - 10, PAGE.width - PAGE.marginX, footerY - 10);

  /* Left: Institution name + disclaimer */
  doc.setTextColor(...COLORS.onSurface);
  doc.setFontSize(FONT_SIZES.labelLg);
  doc.setFont("helvetica", "bold");
  doc.text("Stratizen University Dining Services", PAGE.marginX, footerY - 5);

  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.labelMd);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This document is electronically generated and verified for internal auditing.",
    PAGE.marginX,
    footerY - 1
  );

  /* Right: Page number */
  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.labelLg);
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE.width - PAGE.marginX, footerY - 5, { align: "right" });

  /* Page indicator dots */
  const dotX = PAGE.width - PAGE.marginX;
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(dotX - 14, footerY - 2, 6, 1.2, 0.6, 0.6, "F");
  doc.setFillColor(...COLORS.outlineVariant);
  doc.roundedRect(dotX - 7, footerY - 2, 2, 1.2, 0.6, 0.6, "F");
  doc.roundedRect(dotX - 4, footerY - 2, 2, 1.2, 0.6, 0.6, "F");
}

/* ── Public Export Function ────────────────────────────────── */

export async function generateDailyReport(onProgress, role) {
  try {
    if (onProgress) onProgress("fetching");

    const data = await fetchReportData(role);

    if (onProgress) onProgress("generating");

    const doc = buildPDF(data);
    const filename = getReportFilename();

    doc.save(filename);

    return { success: true, filename, orderCount: data.totalOrders };
  } catch (err) {
    console.error("PDF generation failed:", err);
    return { success: false, error: err.message };
  }
}
