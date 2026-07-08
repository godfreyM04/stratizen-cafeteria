import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCompletedOrders } from "../services/analyticsService";
import {
  calculateCoreMetrics,
  calculateWeeklyRevenueTrend,
  calculateTopMenuItems,
  calculateTopChefs
} from "../utils/analyticsHelper";
import { generateExecutiveReport } from "../utils/generateExecutiveReport";
import "../styles/ReportsAnalytics.css";

function ReportsAnalytics() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Navigation and state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch completed orders using the shared analytics fetcher
      const orders = await fetchCompletedOrders("admin");
      setCompletedOrders(orders);

      // Fetch chefs list for kitchen performance rankings
      const { data: chefsData, error: chefsError } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "chef");
      if (chefsError) throw chefsError;
      setChefs(chefsData || []);
    } catch (err) {
      console.error("[ReportsAnalytics] Failed to fetch live data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to live postgres updates on orders table
    const ordersSync = supabase
      .channel("reports_dashboard_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        console.log("[ReportsAnalytics] Live orders change, reloading dashboard...");
        loadData();
      })
      .subscribe();

    return () => {
      ordersSync.unsubscribe();
    };
  }, []);

  // Compute metrics dynamically from live Supabase orders state
  const metrics = calculateCoreMetrics(completedOrders);
  const weeklyTrendData = calculateWeeklyRevenueTrend(completedOrders);
  const topMenuItems = calculateTopMenuItems(completedOrders);
  const staffPerformance = calculateTopChefs(completedOrders, chefs);

  // Format currencies helper
  const formatKES = (val) => {
    return "KES " + (val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Get initials for circular chef avatars
  const getChefInitials = (name) => {
    if (!name) return "P";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Y-axis levels calculation for Weekly Trend Graph
  const maxRevenue = Math.max(...weeklyTrendData.map((d) => d.value), 1000);
  const yAxisLevels = [
    maxRevenue,
    maxRevenue * 0.75,
    maxRevenue * 0.5,
    maxRevenue * 0.25,
    0
  ];

  const formatYAxisVal = (val) => {
    if (val >= 1000) {
      return `KES ${(val / 1000).toFixed(0)}k`;
    }
    return `KES ${val.toFixed(0)}`;
  };

  // PDF Export Trigger (reuses existing state, no double query calls)
  const handleExportPDF = async () => {
    try {
      setExporting(true);
      await generateExecutiveReport(metrics, weeklyTrendData, topMenuItems, staffPerformance);
    } catch (err) {
      console.error("[ReportsAnalytics] Failed to export PDF report:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="ra-page-container">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="ra-sidebar">
        <div className="ra-sidebar-header">
          <div className="ra-avatar-container">
            <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#ffffff" }}>
              admin_panel_settings
            </span>
          </div>
          <div>
            <h1 className="ra-admin-name">Stratizen Admin</h1>
            <p className="ra-admin-role">Executive Control</p>
          </div>
        </div>

        <nav className="ra-nav-menu">
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/users")}>
            <span className="material-symbols-outlined">group</span>
            <span>User Management</span>
          </a>
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Management</span>
          </a>
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/orders")}>
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>Orders</span>
          </a>
          <a className="ra-nav-item active" style={{ cursor: "pointer" }}>
            <span className="material-symbols-outlined font-fill">analytics</span>
            <span>Reports & Analytics</span>
          </a>
        </nav>

        <div className="ra-sidebar-footer">
          <button className="ra-logout-btn" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="ra-mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <aside className="ra-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="ra-mobile-drawer-header">
              <div className="ra-avatar-container">
                <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "#ffffff" }}>
                  admin_panel_settings
                </span>
              </div>
              <div>
                <h1 className="ra-admin-name">Stratizen Admin</h1>
                <p className="ra-admin-role">Executive Control</p>
              </div>
            </div>
            <nav className="ra-nav-menu">
              <a className="ra-nav-item" onClick={() => { navigate("/admin/dashboard"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">dashboard</span>
                <span>Dashboard</span>
              </a>
              <a className="ra-nav-item" onClick={() => { navigate("/admin/users"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">group</span>
                <span>User Management</span>
              </a>
              <a className="ra-nav-item" onClick={() => { navigate("/admin/menu"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">restaurant_menu</span>
                <span>Menu Management</span>
              </a>
              <a className="ra-nav-item" onClick={() => { navigate("/admin/orders"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">shopping_cart</span>
                <span>Orders</span>
              </a>
              <a className="ra-nav-item active" onClick={() => setMobileMenuOpen(false)}>
                <span className="material-symbols-outlined font-fill">analytics</span>
                <span>Reports & Analytics</span>
              </a>
            </nav>
            <div className="ra-sidebar-footer">
              <button className="ra-logout-btn" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="ra-main-wrapper">
        <header className="ra-topbar">
          <div className="ra-topbar-left">
            <button className="ra-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="ra-brand-title">Stratizen Cafeteria</h2>
          </div>
          <div className="ra-topbar-right" />
        </header>

        <main className="ra-main-canvas">
          <div className="ra-page-header">
            <div>
              <h1 className="ra-page-title">Reports & Analytics</h1>
              <p className="ra-page-subtitle">Analyze live cafeteria metrics, revenue, staff performance and preparation stats.</p>
            </div>
            <button 
              className="ra-export-btn" 
              onClick={handleExportPDF} 
              disabled={loading || exporting}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              <span>{exporting ? "Exporting PDF..." : "Export Report"}</span>
            </button>
          </div>

          {loading ? (
            <div className="ra-loading-state">
              <div className="ra-spinner" />
              <p>Analyzing live cafeteria databases...</p>
            </div>
          ) : (
            <>
              {/* Statistics Grid */}
              <div className="ra-stats-grid">
                {/* 1. Total Revenue */}
                <div className="ra-stat-card">
                  <div className="ra-stat-icon-wrapper revenue">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div>
                    <span className="ra-stat-label">Total Revenue</span>
                    <h3 className="ra-stat-value">{formatKES(metrics.totalRevenue)}</h3>
                    <p className="ra-stat-desc">Completed order totals</p>
                  </div>
                </div>

                {/* 2. Average Daily Revenue */}
                <div className="ra-stat-card">
                  <div className="ra-stat-icon-wrapper daily">
                    <span className="material-symbols-outlined">calendar_today</span>
                  </div>
                  <div>
                    <span className="ra-stat-label">Avg Daily Revenue</span>
                    <h3 className="ra-stat-value">{formatKES(metrics.avgDailyRevenue)}</h3>
                    <p className="ra-stat-desc">Per active unique day</p>
                  </div>
                </div>

                {/* 3. Total Orders */}
                <div className="ra-stat-card">
                  <div className="ra-stat-icon-wrapper orders">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <span className="ra-stat-label">Total Orders</span>
                    <h3 className="ra-stat-value">{metrics.completedOrdersCount}</h3>
                    <p className="ra-stat-desc">Collected student orders</p>
                  </div>
                </div>

                {/* 4. Average Order Value */}
                <div className="ra-stat-card">
                  <div className="ra-stat-icon-wrapper value">
                    <span className="material-symbols-outlined">analytics</span>
                  </div>
                  <div>
                    <span className="ra-stat-label">Avg Order Value</span>
                    <h3 className="ra-stat-value">{formatKES(metrics.avgOrderValue)}</h3>
                    <p className="ra-stat-desc">AOV per transaction</p>
                  </div>
                </div>
              </div>

              {/* Main Content Layout Split */}
              <div className="ra-content-layout">
                {/* Weekly Revenue Trend Bar Chart */}
                <div className="ra-chart-card">
                  <h3 className="ra-card-title">Weekly Revenue Trend</h3>
                  <p className="ra-card-subtitle">Aggregate completed revenue breakdown for weekdays.</p>

                  <div className="ra-chart-container">
                    <div className="ra-chart-y-axis">
                      {yAxisLevels.map((lvl, index) => (
                        <span key={index}>{formatYAxisVal(lvl)}</span>
                      ))}
                    </div>
                    <div className="ra-chart-bars-wrapper">
                      {weeklyTrendData.map((day) => (
                        <div key={day.name} className="ra-chart-col">
                          <div className="ra-chart-bar-container">
                            <div 
                              className="ra-chart-bar" 
                              style={{ height: `${day.heightPct}%` }}
                            >
                              {day.value > 0 && (
                                <span className="ra-chart-bar-tooltip">
                                  {formatKES(day.value)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="ra-chart-day-label">{day.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Average Prep time efficiency banner inside chart */}
                  <div className="ra-efficiency-banner">
                    <div className="ra-efficiency-left">
                      <span className="material-symbols-outlined text-primary">timer</span>
                      <div>
                        <h4 className="ra-efficiency-title">Average Kitchen Prep Speed</h4>
                        <p className="ra-efficiency-desc">Average elapsed duration from accept to completion.</p>
                      </div>
                    </div>
                    <div className="ra-efficiency-value">
                      {metrics.avgPrepTimeMins > 0 ? `${metrics.avgPrepTimeMins} min` : "—"}
                    </div>
                  </div>
                </div>

                {/* Right Side Column */}
                <div className="ra-sidebar-column">
                  {/* Top Performing Menu Items */}
                  <div className="ra-sidebar-card">
                    <h3 className="ra-card-title mb-sm">Top Performing Menu Items</h3>
                    <div className="ra-ranking-list">
                      {topMenuItems.length === 0 ? (
                        <p className="ra-empty-state">No menu items ordered yet.</p>
                      ) : (
                        topMenuItems.slice(0, 3).map((item, idx) => (
                          <div key={item.name} className="ra-ranking-item">
                            <div className="ra-ranking-info">
                              <div className="ra-rank-badge">{idx + 1}</div>
                              <img className="ra-ranking-image" src={item.image} alt={item.name} />
                              <span className="ra-ranking-name">{item.name}</span>
                            </div>
                            <span className="ra-ranking-stat">{item.count} Orders</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Kitchen Staff Performance */}
                  <div className="ra-sidebar-card">
                    <h3 className="ra-card-title mb-sm">Kitchen Staff Performance</h3>
                    <div className="ra-ranking-list">
                      {staffPerformance.length === 0 ? (
                        <p className="ra-empty-state">No chef profiles registered.</p>
                      ) : (
                        staffPerformance.slice(0, 3).map((chef, idx) => (
                          <div key={chef.id} className="ra-ranking-item">
                            <div className="ra-ranking-info">
                              <div className="ra-rank-badge font-fill">{idx + 1}</div>
                              <div className="ra-avatar-initials">
                                {getChefInitials(chef.name)}
                              </div>
                              <span className="ra-ranking-name">{chef.name}</span>
                            </div>
                            <span className="ra-ranking-stat">{chef.completedCount} Completed</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default ReportsAnalytics;
