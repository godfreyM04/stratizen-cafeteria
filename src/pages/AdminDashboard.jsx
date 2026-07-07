import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "../styles/AdminDashboard.css";

function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Stats loaded from Supabase
  const [studentsCount, setStudentsCount] = useState(0);
  const [chefsCount, setChefsCount] = useState(0);
  const [ordersToday, setOrdersToday] = useState([]);
  const [weeklyOrders, setWeeklyOrders] = useState([]);

  // Fetch stats dynamically
  const fetchStats = async () => {
    try {
      // 1. Fetch Students count (profiles where role = student)
      const { count: sCount, error: sError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");
      if (sError) throw sError;
      setStudentsCount(sCount || 0);

      // 2. Fetch Chefs count (profiles where role = chef)
      const { count: cCount, error: cError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "chef");
      if (cError) throw cError;
      setChefsCount(cCount || 0);

      // 3. Fetch Orders today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: oToday, error: oError } = await supabase
        .from("orders")
        .select("*")
        .gte("created_at", todayStart.toISOString());
      if (oError) throw oError;
      setOrdersToday(oToday || []);

      // 4. Fetch Weekly orders (for weekly trends graph)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const { data: oWeekly, error: wError } = await supabase
        .from("orders")
        .select("created_at")
        .gte("created_at", sevenDaysAgo.toISOString());
      if (wError) throw wError;
      setWeeklyOrders(oWeekly || []);

    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Subscribe to changes on orders
    const orderSubscription = supabase
      .channel("admin_orders_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchStats();
      })
      .subscribe();

    // Subscribe to changes on profiles
    const profileSubscription = supabase
      .channel("admin_profiles_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
      profileSubscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  // Memoized metrics calculations
  const stats = useMemo(() => {
    const total = ordersToday.length;
    const active = ordersToday.filter(o => ["pending", "preparing", "ready"].includes(o.status)).length;
    const completed = ordersToday.filter(o => o.status === "collected").length;
    
    // Revenue today is completed collected orders' sum
    const revenue = ordersToday
      .filter(o => o.status === "collected")
      .reduce((sum, o) => sum + parseFloat(o.total || o.total_price || 0), 0);

    return { total, active, completed, revenue };
  }, [ordersToday]);

  // Memoized weekly trends bar heights
  const weeklyBarData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push({
        dateStr: d.toDateString(),
        label: days[d.getDay()],
        count: 0
      });
    }

    weeklyOrders.forEach(o => {
      const oDateStr = new Date(o.created_at).toDateString();
      const dayObj = last7Days.find(d => d.dateStr === oDateStr);
      if (dayObj) {
        dayObj.count++;
      }
    });

    const maxCount = Math.max(...last7Days.map(d => d.count), 1);
    return last7Days.map(day => ({
      ...day,
      heightPct: Math.max((day.count / maxCount) * 100, 4)
    }));
  }, [weeklyOrders]);

  if (loading) {
    return (
      <div className="ad-loading-screen">
        <div className="ad-spinner"></div>
        <p>Loading Administrator Dashboard...</p>
      </div>
    );
  }

  // Ratio of completed to total orders (for mini progress bar)
  const completedPct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 100;
  const activePct = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;

  return (
    <div className="ad-app-container">
      {/* SideNavBar (Desktop) */}
      <aside className="ad-sidebar">
        <div className="ad-sidebar-header">
          <div className="ad-avatar-container">
            <img
              alt="Admin Avatar"
              className="ad-avatar-img"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
            />
          </div>
          <div>
            <h1 className="ad-admin-name">Stratizen Admin</h1>
            <p className="ad-admin-role">Executive Control</p>
          </div>
        </div>

        <nav className="ad-nav-menu">
          <a className="ad-nav-item active" href="#dashboard">
            <span className="material-symbols-outlined font-fill">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="ad-nav-item" href="#users" onClick={(e) => e.preventDefault()}>
            <span className="material-symbols-outlined">group</span>
            <span>User Management</span>
          </a>
          <a className="ad-nav-item" href="#menu" onClick={(e) => e.preventDefault()}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Management</span>
          </a>
          <a className="ad-nav-item" href="#orders" onClick={(e) => e.preventDefault()}>
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>Orders</span>
          </a>
          <a className="ad-nav-item" href="#analytics" onClick={(e) => e.preventDefault()}>
            <span className="material-symbols-outlined">analytics</span>
            <span>Reports & Analytics</span>
          </a>
        </nav>

        <div className="ad-sidebar-footer">
          <button className="ad-logout-btn" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="ad-mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <aside className="ad-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="ad-sidebar-header">
              <div className="ad-avatar-container">
                <img
                  alt="Admin Avatar"
                  className="ad-avatar-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
                />
              </div>
              <div>
                <h1 className="ad-admin-name">Stratizen Admin</h1>
                <p className="ad-admin-role">Executive Control</p>
              </div>
            </div>
            <nav className="ad-nav-menu">
              <a className="ad-nav-item active" href="#dashboard" onClick={() => setMobileMenuOpen(false)}>
                <span className="material-symbols-outlined font-fill">dashboard</span>
                <span>Dashboard</span>
              </a>
              <a className="ad-nav-item" href="#users" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">group</span>
                <span>User Management</span>
              </a>
              <a className="ad-nav-item" href="#menu" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">restaurant_menu</span>
                <span>Menu Management</span>
              </a>
              <a className="ad-nav-item" href="#orders" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">shopping_cart</span>
                <span>Orders</span>
              </a>
              <a className="ad-nav-item" href="#analytics" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">analytics</span>
                <span>Reports & Analytics</span>
              </a>
            </nav>
            <div className="ad-sidebar-footer">
              <button className="ad-logout-btn" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="ad-main-wrapper">
        {/* TopNavBar */}
        <header className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="ad-brand-title">Stratizen Cafeteria</div>
          </div>

          {/* Search Bar */}
          <div className="ad-search-container">
            <span className="material-symbols-outlined ad-search-icon">search</span>
            <input
              className="ad-search-input"
              placeholder="Search orders, menus, or users..."
              type="text"
            />
          </div>

          <div className="ad-topbar-right">
            <button className="ad-icon-btn">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="ad-icon-btn">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="ad-profile-mini">
              <img
                alt="Admin Profile"
                className="ad-profile-mini-img"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxhNDVwDlKnCqK22qnnXgHL_YtjvXj3rn04Efc5Uq3YudBm4nVjgnm8LfUG1WqIO62uzXRIaXG6fvH__S-GhepeG2k78dlnQwxubHfHIjERQ-zDxIJMwW1Jwo4mL5pr07x--y8uLLhg2GuW-fRSXA_JWqso_w39FVEkwXh7fR2JNoENSp5hK93r-wbVuXG7Nju7uMkrLC_6b_NY7I65wR1iNoifkr3ZJ1v0qUa-gt_QN3qMEcaaSI"
              />
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="ad-main-canvas">
          {/* Page Header */}
          <div className="ad-page-header">
            <h2 className="ad-page-title desktop">Dashboard Overview</h2>
            <h2 className="ad-page-title mobile">Dashboard Overview</h2>
            <p className="ad-page-subtitle">Key metrics and recent activity for today.</p>
          </div>

          {/* KPI Cards Bento Grid */}
          <div className="ad-kpi-grid">
            {/* Total Students */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-card-header">
                <span className="ad-kpi-label">Total Students</span>
                <div className="ad-kpi-icon-container bg-secondary-container text-on-secondary-container">
                  <span className="material-symbols-outlined text-sm">school</span>
                </div>
              </div>
              <div className="ad-kpi-value-container">
                <div className="ad-kpi-value">{studentsCount.toLocaleString()} Students</div>
              </div>
            </div>

            {/* Total Chefs */}
            <div className="ad-kpi-card">
              <div className="ad-kpi-card-header">
                <span className="ad-kpi-label">Total Chefs</span>
                <div className="ad-kpi-icon-container bg-tertiary-container text-on-tertiary-container">
                  <span className="material-symbols-outlined text-sm">local_dining</span>
                </div>
              </div>
              <div className="ad-kpi-value-container">
                <div className="ad-kpi-value">{chefsCount.toLocaleString()} Chefs</div>
              </div>
            </div>

            {/* Orders Today & Active/Completed */}
            <div className="ad-kpi-card ad-kpi-double">
              <div className="ad-kpi-card-body-horizontal">
                <div>
                  <div className="ad-kpi-value">{stats.total}</div>
                  <div className="ad-kpi-sublabel">Total Orders Today</div>
                </div>
                <div className="ad-kpi-split-vals">
                  <div className="ad-kpi-split-group">
                    <div className="ad-split-val text-primary">{stats.active}</div>
                    <div className="ad-split-label">Active</div>
                  </div>
                  <div className="ad-kpi-split-group">
                    <div className="ad-split-val text-secondary">{stats.completed}</div>
                    <div className="ad-split-label">Completed</div>
                  </div>
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="ad-kpi-progress-track">
                <div className="ad-progress-bar bg-secondary" style={{ width: `${completedPct}%` }}></div>
                <div className="ad-progress-bar bg-primary" style={{ width: `${activePct}%` }}></div>
              </div>
            </div>

            {/* Revenue Today */}
            <div className="ad-kpi-card ad-kpi-highlighted bg-primary">
              <div className="ad-kpi-card-header">
                <span className="ad-kpi-label text-primary-fixed">Revenue Today</span>
                <div className="ad-kpi-icon-container bg-on-primary-20 text-on-primary">
                  <span className="material-symbols-outlined text-sm">payments</span>
                </div>
              </div>
              <div className="ad-kpi-value-container">
                <div className="ad-kpi-value text-white">KES {stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Analytics & Charts Row */}
          <div className="ad-analytics-row">
            <div className="ad-chart-card">
              <div className="ad-chart-header">
                <h3 className="ad-chart-title">Orders Over Time</h3>
                <div className="ad-chart-toggle-group">
                  <span className="ad-chart-tab">Day</span>
                  <span className="ad-chart-tab active">Week</span>
                </div>
              </div>
              {/* Bar Graph */}
              <div className="ad-chart-canvas">
                {weeklyBarData.map((day, idx) => (
                  <div key={idx} className="ad-chart-bar-column">
                    <div className="ad-chart-bar-wrapper">
                      <div
                        className={`ad-chart-bar-fill ${day.dateStr === new Date().toDateString() ? "active" : ""}`}
                        style={{ height: `${day.heightPct}%` }}
                        title={`${day.count} orders`}
                      ></div>
                    </div>
                    <span className="ad-chart-bar-label">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
