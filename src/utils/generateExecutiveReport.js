/**
 * generateExecutiveReport.js
 * 
 * Generates a beautifully formatted Executive Analytics PDF Report.
 * Uses jsPDF + jspdf-autotable.
 * Sourced from live Supabase data.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";

// Colors aligned with Administrator design theme
const COLORS = {
  primary:              [0, 40, 142],      // #00288E
  primaryContainer:     [30, 64, 175],     // #1E40AF
  onPrimary:            [255, 255, 255],
  onSurface:            [25, 28, 29],      // #191C1D
  onSurfaceVariant:     [68, 70, 83],      // #444653
  surfaceContainerLow:  [243, 244, 245],   // #F3F4F5
  surfaceContainer:     [237, 238, 239],   // #EDEEEF
  outlineVariant:       [196, 197, 213],   // #C4C5D5
  secondary:            [80, 95, 118],     // #505F76
  secondaryContainer:   [208, 225, 251],   // #D0E1FB
  onSecondaryContainer: [84, 100, 122],    // #54647A
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

const PAGE = {
  width:  210,
  height: 297,
  marginX: 20,
  marginY: 20,
};

const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

// Helper to format currency
const formatKES = (n) =>
  "KES " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateShort = (dateObj) => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
};

// Formats a time to a safe filename string
const getSafeTimeStr = () => {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const hStr = h.toString().padStart(2, "0");
  return `${hStr}-${m} ${ampm}`;
};

// Formats date nicely for executive summary
const getFormattedDateLong = () => {
  const now = new Date();
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const day = now.getDate().toString().padStart(2, "0");
  return `${day} ${months[now.getMonth()]} ${now.getFullYear()}`;
};

const getFormattedTimeLong = () => {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const hStr = h.toString().padStart(2, "0");
  return `${hStr}:${m} ${ampm}`;
};

// Draws a card with dynamic rounded background and value
function drawKPICard(doc, x, y, width, label, value) {
  // Rounded rect
  doc.setFillColor(...COLORS.surfaceContainerLow);
  doc.roundedRect(x, y, width, 24, 3, 3, "F");

  // Border outline
  doc.setDrawColor(...COLORS.outlineVariant);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, width, 24, 3, 3, "D");

  // Label
  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.labelMd);
  doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), x + 6, y + 8);

  // Value
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 6, y + 17);
}

// Draws the footer page markings
function drawFooter(doc, pageNumber, pageCount) {
  doc.setPage(pageNumber);
  doc.setDrawColor(...COLORS.outlineVariant);
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginX, PAGE.height - PAGE.marginY, PAGE.width - PAGE.marginX, PAGE.height - PAGE.marginY);

  doc.setTextColor(...COLORS.onSurfaceVariant);
  doc.setFontSize(FONT_SIZES.labelMd);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Executive Analytics Report  |  Confidential Internal Audit`,
    PAGE.marginX,
    PAGE.height - PAGE.marginY + 6
  );

  doc.text(
    `Page ${pageNumber} of ${pageCount}`,
    PAGE.width - PAGE.marginX,
    PAGE.height - PAGE.marginY + 6,
    { align: "right" }
  );
}

// Main PDF Generator
export async function generateExecutiveReport(metrics, weeklyTrendData, topMenuItems, staffPerformance) {
  try {
    const totalRevenue = metrics.totalRevenue;
    const totalOrdersCount = metrics.completedOrdersCount;
    const avgDailyRevenue = metrics.avgDailyRevenue;
    const avgOrderValue = metrics.avgOrderValue;
    const avgPrepTimeStr = metrics.avgPrepTimeMins > 0 ? `${metrics.avgPrepTimeMins} min` : "—";

    // Map weeklyTrendData to a map by day name
    const weekdayRevenue = {};
    (weeklyTrendData || []).forEach(d => {
      weekdayRevenue[d.name] = d.value;
    });

    const topItems = (topMenuItems || []).map(item => ({
      name: item.name,
      count: item.count
    }));

    const rankedChefs = (staffPerformance || []).map(chef => ({
      name: chef.name,
      count: chef.completedCount
    }));

    // 3. Build the PDF Document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    let cursorY = PAGE.marginY;

    /* ─── HEADER SECTION ───────────────────────────────────── */
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(PAGE.marginX, cursorY, 12, 12, 2, 2, "F");
    
    // Draw restaurant icon in code
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("S", PAGE.marginX + 4, cursorY + 8.5);

    doc.setTextColor(...COLORS.primary);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Performance Report", PAGE.marginX + 16, cursorY + 8.5);

    doc.setTextColor(...COLORS.onSurfaceVariant);
    doc.setFontSize(FONT_SIZES.labelMd);
    doc.setFont("helvetica", "bold");
    doc.text("STRATIZEN CAFETERIA", PAGE.width - PAGE.marginX, cursorY + 8.5, { align: "right" });

    cursorY += 18;

    /* Divider */
    doc.setDrawColor(...COLORS.outlineVariant);
    doc.setLineWidth(0.4);
    doc.line(PAGE.marginX, cursorY, PAGE.width - PAGE.marginX, cursorY);

    cursorY += 8;

    /* ─── EXECUTIVE SUMMARY ────────────────────────────────── */
    doc.setTextColor(...COLORS.onSurface);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Executive Summary", PAGE.marginX, cursorY);
    
    cursorY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.onSurfaceVariant);

    doc.text(`Report Generation Date: ${getFormattedDateLong()}`, PAGE.marginX, cursorY);
    doc.text(`Report Generation Time: ${getFormattedTimeLong()}`, PAGE.marginX + 75, cursorY);
    doc.text(`Administrator Name: Stratizen Admin`, PAGE.marginX + 130, cursorY);

    cursorY += 10;

    /* ─── KEY METRICS (KPI Cards) ──────────────────────────── */
    const gap = 3;
    const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;

    drawKPICard(doc, PAGE.marginX, cursorY, cardWidth, "Total Revenue", formatKES(totalRevenue));
    drawKPICard(doc, PAGE.marginX + (cardWidth + gap), cursorY, cardWidth, "Avg Daily Revenue", formatKES(avgDailyRevenue));
    drawKPICard(doc, PAGE.marginX + (cardWidth + gap) * 2, cursorY, cardWidth, "Total Orders", `${totalOrdersCount} Orders`);
    drawKPICard(doc, PAGE.marginX + (cardWidth + gap) * 3, cursorY, cardWidth, "Avg Order Value", formatKES(avgOrderValue));

    cursorY += 34;

    /* Draw Average Prep time card badge below */
    doc.setFillColor(...COLORS.surfaceContainerLow);
    doc.roundedRect(PAGE.marginX, cursorY, CONTENT_WIDTH, 10, 2, 2, "F");
    doc.setTextColor(...COLORS.onSurfaceVariant);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(`AVERAGE PREPARATION EFFICIENCY ACROSS KITCHEN STAFF:`, PAGE.marginX + 6, cursorY + 6.5);
    
    doc.setTextColor(...COLORS.primary);
    doc.text(avgPrepTimeStr, PAGE.width - PAGE.marginX - 6, cursorY + 6.5, { align: "right" });

    cursorY += 18;

    /* ─── WEEKLY REVENUE TREND GRAPH ────────────────────────── */
    doc.setTextColor(...COLORS.onSurface);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Weekly Revenue Trend", PAGE.marginX, cursorY);

    cursorY += 6;

    // Draw weekly bar graph in PDF
    const chartHeight = 35;
    const chartWidth = CONTENT_WIDTH - 20;
    const chartX = PAGE.marginX + 12;
    const chartY = cursorY + chartHeight;

    // Draw baseline
    doc.setDrawColor(...COLORS.outlineVariant);
    doc.setLineWidth(0.4);
    doc.line(chartX, chartY, chartX + chartWidth, chartY);

    // Calculate weekday heights
    const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const revenues = daysList.map(d => weekdayRevenue[d]);
    const maxRevenue = Math.max(...revenues, 1000); // base min height divisor

    const numBars = daysList.length;
    const barWidth = 14;
    const barSpacing = (chartWidth - barWidth * numBars) / (numBars + 1);

    daysList.forEach((day, index) => {
      const dayRev = weekdayRevenue[day];
      const barHeight = (dayRev / maxRevenue) * chartHeight;
      const barX = chartX + barSpacing + (barWidth + barSpacing) * index;
      const barY = chartY - barHeight;

      // Draw bar rect
      doc.setFillColor(...COLORS.primaryContainer);
      doc.rect(barX, barY, barWidth, barHeight, "F");

      // Draw value text above bar
      doc.setTextColor(...COLORS.primary);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      const revText = dayRev > 0 ? `${(dayRev / 1000).toFixed(1)}k` : "0";
      doc.text(revText, barX + barWidth / 2, barY - 2, { align: "center" });

      // Draw label under bar
      doc.setTextColor(...COLORS.onSurfaceVariant);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(day.substring(0, 3), barX + barWidth / 2, chartY + 4, { align: "center" });
    });

    cursorY += chartHeight + 12;

    /* ─── TABLES GRID (Top Items & Chefs) ────────────────────── */
    // Split into 2 columns on the second page or below
    // To ensure print layout looks amazing and doesn't overflow, let's force a page break!
    doc.addPage();
    cursorY = PAGE.marginY;

    // Column 1: Top Performing Items
    doc.setTextColor(...COLORS.onSurface);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Top Performing Menu Items", PAGE.marginX, cursorY);

    cursorY += 6;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: PAGE.marginX, right: PAGE.width / 2 + 2 },
      head: [["Menu Item Name", "Orders Count"]],
      body: topItems.length === 0 ? [["No data available", "0"]] : topItems.slice(0, 3).map(item => [item.name, `${item.count} orders`]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 4,
        lineColor: [...COLORS.outlineVariant],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.surfaceContainer,
        textColor: COLORS.onSurfaceVariant,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: COLORS.primary },
        1: { halign: "right" }
      }
    });

    // Column 2: Chef Performance Table
    doc.setTextColor(...COLORS.onSurface);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Kitchen Staff Performance", PAGE.width / 2 + 6, cursorY - 6);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: PAGE.width / 2 + 6, right: PAGE.marginX },
      head: [["Chef Name", "Completed Orders"]],
      body: rankedChefs.length === 0 ? [["No chefs registered", "0"]] : rankedChefs.slice(0, 3).map(chef => [chef.name, `${chef.count} completed`]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 4,
        lineColor: [...COLORS.outlineVariant],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORS.surfaceContainer,
        textColor: COLORS.onSurfaceVariant,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: COLORS.primary },
        1: { halign: "right" }
      }
    });

    // Draw Footer elements
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      drawFooter(doc, i, pageCount);
    }

    // 4. Save and Download the PDF
    const todayStr = getFormattedDateLong();
    const timeStr = getSafeTimeStr();
    const filename = `Executive Analytics Report on ${todayStr} at ${timeStr}.pdf`;
    
    doc.save(filename);
    console.log(`[Executive Report] Saved and auto-downloaded PDF as: ${filename}`);

  } catch (err) {
    console.error("[Executive Report] Failed to generate PDF report:", err);
    alert("Error generating report: " + err.message);
  }
}
