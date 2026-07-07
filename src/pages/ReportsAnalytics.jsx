import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { generateExecutiveReport } from "../utils/generateExecutiveReport";
import "../styles/ReportsAnalytics.css";

// Helper to format currency
function formatKES(amount) {
  const num = parseFloat(amount) || 0;
  return "KES " + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReportsAnalytics() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // States for analytical data
  const [orders, setOrders] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  // Fetch all live Supabase data
  const fetchAnalyticsData = useCallback(async () => {
    try {
      // 1. Fetch completed orders with items & menu mappings
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(
            quantity,
            menu(id, name, image_url)
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // 2. Fetch all chefs
      const { data: chefsData, error: chefsError } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "chef");

      if (chefsError) throw chefsError;
      setChefs(chefsData || []);

    } catch (err) {
      console.error("[Reports] Error loading analytics data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();

    // Subscribe to real-time updates for orders
    const orderSubscription = supabase
      .channel("admin_reports_sync_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        console.log("[Reports] Real-time orders update detected, re-fetching...");
        fetchAnalyticsData();
      })
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, [fetchAnalyticsData]);

  // Executive summary calculations (memoized)
  const metrics = useMemo(() => {
    const completed = orders.filter((o) => o.status === "collected");
    const totalRevenue = completed.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const totalOrdersCount = completed.length;

    // Average daily revenue: Total Revenue / unique days with completed orders
    const uniqueDays = new Set(completed.map((o) => new Date(o.created_at).toDateString()));
    const numDays = uniqueDays.size || 1;
    const avgDailyRevenue = totalRevenue / numDays;

    // Average order value
    const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

    // Average preparation time: (ready_at - prep_started_at)
    const prepOrders = completed.filter((o) => o.prep_started_at && o.ready_at);
    let avgPrepTimeMins = 0;
    if (prepOrders.length > 0) {
      const totalPrepTimeMs = prepOrders.reduce((sum, o) => {
        const start = new Date(o.prep_started_at).getTime();
        const ready = new Date(o.ready_at).getTime();
        return sum + Math.max(0, ready - start);
      }, 0);
      const avgPrepMs = totalPrepTimeMs / prepOrders.length;
      avgPrepTimeMins = Math.round(avgPrepMs / 60000);
    }

    return {
      completedOrdersCount: totalOrdersCount,
      totalRevenue,
      avgDailyRevenue,
      avgOrderValue,
      avgPrepTimeMins,
      completed,
    };
  }, [orders]);

  // Weekly Revenue Trend vertical bar heights
  const weeklyTrendData = useMemo(() => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dailyRevMap = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };

    metrics.completed.forEach((o) => {
      const d = new Date(o.created_at);
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = daysOfWeek[d.getDay()];
      dailyRevMap[dayName] += parseFloat(o.total || 0);
    });

    const maxRevenue = Math.max(...Object.values(dailyRevMap), 1000);

    return days.map((day) => ({
      name: day,
      label: day.substring(0, 3),
      value: dailyRevMap[day],
      heightPct: Math.max((dailyRevMap[day] / maxRevenue) * 100, 2),
    }));
  }, [metrics]);

  // Top Performing Menu Items ranked by popularity
  const topMenuItems = useMemo(() => {
    const itemMap = {};

    metrics.completed.forEach((order) => {
      (order.order_items || []).forEach((oi) => {
        const itemId = oi.menu?.id;
        if (itemId) {
          if (!itemMap[itemId]) {
            itemMap[itemId] = {
              name: oi.menu.name,
              image: oi.menu.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
              count: 0,
            };
          }
          itemMap[itemId].count += oi.quantity;
        }
      });
    });

    return Object.values(itemMap).sort((a, b) => b.count - a.count);
  }, [metrics]);

  // Kitchen Staff Performance ranking
  const staffPerformance = useMemo(() => {
    const chefCounts = {};

    metrics.completed.forEach((order) => {
      if (order.assigned_chef_id) {
        chefCounts[order.assigned_chef_id] = (chefCounts[order.assigned_chef_id] || 0) + 1;
      }
    });

    return chefs
      .map((chef) => ({
        id: chef.id,
        name: chef.full_name,
        photo: "https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc", // default executive theme avatar
        completedCount: chefCounts[chef.id] || 0,
      }))
      .sort((a, b) => b.completedCount - a.completedCount);
  }, [chefs, metrics]);

  // Export PDF Report handler
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await generateExecutiveReport();
    } catch (e) {
      console.error(e);
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
            <img
              alt="Admin"
              className="ra-avatar-img"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
            />
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
            <div className="ra-sidebar-header">
              <div className="ra-avatar-container">
                <img
                  alt="Admin"
                  className="ra-avatar-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
                />
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
          {/* Header Action Bar */}
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
                      <span>100%</span>
                      <span>50%</span>
                      <span>0%</span>
                    </div>

                    <div className="ra-chart-bars-wrapper">
                      {weeklyTrendData.map((day) => (
                        <div key={day.name} className="ra-chart-col">
                          <div className="ra-chart-bar-container">
                            <div 
                              className="ra-chart-bar" 
                              style={{ height: `${day.heightPct}%` }}
                              title={formatKES(day.value)}
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
                        topMenuItems.slice(0, 5).map((item, idx) => (
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
                        staffPerformance.map((chef, idx) => (
                          <div key={chef.id} className="ra-ranking-item">
                            <div className="ra-ranking-info">
                              <div className="ra-rank-badge font-fill">{idx + 1}</div>
                              <img className="ra-ranking-image rounded-avatar" src={chef.photo} alt={chef.name} />
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
