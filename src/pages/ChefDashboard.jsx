import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
import "../styles/ChefDashboard.css";

/* ── Helpers ───────────────────────────────────────────────── */

const formatTimeAgo = (isoString) => {
  if (!isoString) return "";
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const padCount = (n) => (n < 10 ? `0${n}` : String(n));

/* ── Component ─────────────────────────────────────────────── */

function ChefDashboard() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  /* State */
  const [stats, setStats] = useState({
    pending: 0,
    preparing: 0,
    ready: 0,
    completed: 0,
    revenue: 0,
    avgPrep: 0,
  });
  const [orders, setOrders] = useState([]);
  const [processingOrders, setProcessingOrders] = useState({});
  const [loading, setLoading] = useState(true);

  /* ── Data Loader ──────────────────────────────────────────── */
  const loadDashboardData = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStr = todayStart.toISOString();

      const { data: todayOrders, error: ordersError } = await supabase
        .from("orders")
        .select("*, order_items(*, menu(*))")
        .gte("created_at", todayStr);

      if (ordersError) throw ordersError;

      const allOrders = todayOrders || [];

      /* Stats */
      const pendingCount = allOrders.filter((o) => o.status === "pending").length;
      const preparingCount = allOrders.filter((o) => o.status === "preparing").length;
      const readyCount = allOrders.filter((o) => o.status === "ready").length;
      const completedCount = allOrders.filter((o) => o.status === "collected").length;

      let totalRev = 0;
      let totalPrepMins = 0;
      let completedWithPrep = 0;

      allOrders.forEach((o) => {
        if (o.status === "collected" || o.status === "ready") {
          totalRev += parseFloat(o.total || o.total_price || 0);
        }
        if (o.status === "collected" && o.prep_started_at && o.ready_at) {
          const mins = (new Date(o.ready_at) - new Date(o.prep_started_at)) / 60000;
          if (mins > 0) {
            totalPrepMins += mins;
            completedWithPrep++;
          }
        }
      });

      setStats({
        pending: pendingCount,
        preparing: preparingCount,
        ready: readyCount,
        completed: completedCount,
        revenue: totalRev,
        avgPrep: completedWithPrep > 0 ? Math.round(totalPrepMins / completedWithPrep) : 0,
      });

      /* Pending orders queue */
      const pendingQueue = allOrders
        .filter((o) => o.status === "pending")
        .map((o) => ({
          id: o.id,
          name: o.student_name || "Student",
          items: (o.order_items || []).map(
            (oi) => `${oi.quantity}x ${oi.menu?.name || "Meal"}`
          ),
          time: formatTimeAgo(o.created_at),
          placedAt: o.created_at,
          status: o.status,
        }))
        .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));

      setOrders(pendingQueue);


    } catch (err) {
      console.error("Failed to load chef dashboard data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Real‑time subscription ───────────────────────────────── */
  useEffect(() => {
    loadDashboardData();

    const orderSubscription = supabase
      .channel("chef_dashboard_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("Real-time order update received on Chef Dashboard");
          loadDashboardData();
        }
      )
      .subscribe();

    /* Refresh relative timestamps every minute */
    const interval = setInterval(() => {
      setOrders((prev) =>
        prev.map((o) => ({ ...o, time: formatTimeAgo(o.placedAt) }))
      );
    }, 60000);

    return () => {
      orderSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, [loadDashboardData]);

  /* ── Start Preparing handler ──────────────────────────────── */
  const handleStartPreparing = async (orderId) => {
    setProcessingOrders((prev) => ({ ...prev, [orderId]: true }));
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "preparing",
          prep_started_at: new Date().toISOString(),
          assigned_chef_id: user?.id
        })
        .eq("id", orderId);
      if (error) {
        const currentOrder = orders.find(o => o.id === orderId);
        const existingNotes = currentOrder?.notes || "";
        const updatedNotes = `ChefID:${user?.id}` + (existingNotes ? ` | ${existingNotes}` : "");

        const { error: fallbackError } = await supabase
          .from("orders")
          .update({
            status: "preparing",
            prep_started_at: new Date().toISOString(),
            notes: updatedNotes
          })
          .eq("id", orderId);

        if (fallbackError) throw fallbackError;
      }
    } catch (err) {
      console.error("Failed to start preparing order:", err.message);
      alert("Failed to update order status: " + err.message);
    } finally {
      setProcessingOrders((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }
  };


  /* ── Loading state ────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="cd-loading">
        <div className="cd-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="chef-dashboard">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="cd-sidebar">
        <div className="cd-sidebar-logo">
          <div className="cd-sidebar-logo-icon">
            <span className="material-symbols-outlined">restaurant</span>
          </div>
          <div className="cd-sidebar-logo-text">
            <h1>Stratizen Dining</h1>
            <p>Chef Management Portal</p>
          </div>
        </div>

        <nav className="cd-sidebar-nav">
          <button className="cd-nav-item active" type="button">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Kitchen Dashboard</span>
          </button>
          <button className="cd-nav-item" type="button" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Order Queue</span>
          </button>
          <button className="cd-nav-item" type="button" onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Manager</span>
          </button>
          <button className="cd-nav-item" type="button" onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
            <span>Kitchen Monitor</span>
          </button>
          <button className="cd-nav-item" type="button" onClick={() => navigate("/chef/ready")}>
            <span className="material-symbols-outlined">storefront</span>
            <span>Ready to Collect</span>
          </button>
          <button className="cd-nav-item" type="button" onClick={() => navigate("/chef/history")}>
            <span className="material-symbols-outlined">history</span>
            <span>Order History</span>
          </button>
        </nav>

        <div className="cd-sidebar-footer">
          <ChefLogoutButton />
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="cd-main">
        {/* Top App Bar */}
        <header className="cd-topbar">
          <div className="cd-search">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search orders or items..." />
          </div>

          <div className="cd-topbar-actions">
            <ChefNotificationCentre />
            <div className="cd-topbar-divider" />
            <div className="cd-profile">
              <div className="cd-profile-info">
                <p className="name">Chef Anderson</p>
                <p className="role">Executive Chef</p>
              </div>
              <img
                className="cd-profile-avatar"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEcZCcEVpXa-MozwkTjzFQVIHYcYYM5akFrOMnj_D_vvqsfynOXdhbY75zobj4CTHb8jYUJoC-1tpYQLa3RrbBnwrmwvylrIRJ_DJaBLS0lAmOCvpaGz6Yafdw53X1sisa6nnDEP2oGCk-aWh3JpRv1hVf50hHdfL5KXrrmZUK_mfWAhSiVkP7MZSX602-XhGAL5NA-z_LKpjE3Vw5ipDGT703O6ivUTY1IMLDg-VhuvorjqcnwiYPMzJbhgmGsdbxAOJjYc9I_g"
                alt="Chef Anderson avatar"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="cd-content">
          {/* ── Stats Cards ──────────────────────────────────── */}
          <section className="cd-stats-grid">
            <div
              className="cd-stat-card pending"
              onClick={() => navigate("/chef/pending")}
            >
              <div className="cd-stat-header">
                <div>
                  <p className="cd-stat-label">Pending Orders</p>
                  <h2 className="cd-stat-value pending">{padCount(stats.pending)}</h2>
                </div>
                <span className="cd-stat-icon pending">
                  <span className="material-symbols-outlined">pending_actions</span>
                </span>
              </div>
            </div>

            <div
              className="cd-stat-card preparing"
              onClick={() => navigate("/chef/monitor")}
            >
              <div className="cd-stat-header">
                <div>
                  <p className="cd-stat-label">Preparing</p>
                  <h2 className="cd-stat-value preparing">{padCount(stats.preparing)}</h2>
                </div>
                <span className="cd-stat-icon preparing">
                  <span className="material-symbols-outlined">chef_hat</span>
                </span>
              </div>
            </div>

            <div
              className="cd-stat-card ready"
              onClick={() => navigate("/chef/ready")}
            >
              <div className="cd-stat-header">
                <div>
                  <p className="cd-stat-label">Ready to Collect</p>
                  <h2 className="cd-stat-value ready">{padCount(stats.ready)}</h2>
                </div>
                <span className="cd-stat-icon ready">
                  <span className="material-symbols-outlined">hourglass_empty</span>
                </span>
              </div>
            </div>

            <div
              className="cd-stat-card completed"
              onClick={() => navigate("/chef/history")}
            >
              <div className="cd-stat-header">
                <div>
                  <p className="cd-stat-label">Completed</p>
                  <h2 className="cd-stat-value completed">{stats.completed}</h2>
                </div>
                <span className="cd-stat-icon completed">
                  <span className="material-symbols-outlined">check_circle</span>
                </span>
              </div>
            </div>
          </section>

          {/* ── Incoming Orders ───────────────────────────────── */}
          <section className="cd-orders-section">
            <div className="cd-orders-header">
              <h3 className="cd-orders-title">Incoming Orders</h3>
              <button
                className="cd-view-all-btn"
                type="button"
                onClick={() => navigate("/chef/pending")}
              >
                View All Queue
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>

            <div className="cd-orders-list">
              {orders.length === 0 ? (
                <div className="cd-empty-state">
                  <span className="material-symbols-outlined">done_all</span>
                  <p>All orders have been prepared!</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="cd-order-card">
                    <div className="cd-order-left">
                      <div className="cd-ticket-box">
                        <p className="cd-ticket-label">Ticket</p>
                        <p className="cd-ticket-number">
                          #{order.id.substring(0, 4).toUpperCase()}
                        </p>
                      </div>
                      <div className="cd-order-info">
                        <h4 className="cd-order-name">{order.name}</h4>
                        <div className="cd-order-items">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item, i) => (
                              <React.Fragment key={i}>
                                {i === 0 && <span className="dot" />}
                                <span>{item}</span>
                                {i < order.items.length - 1 && (
                                  <span className="separator">•</span>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <span>No items</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="cd-order-right">
                      <div className="cd-order-time">
                        <p className="label">Received</p>
                        <p className="value">{order.time}</p>
                      </div>
                      <button
                        className={`cd-start-btn${processingOrders[order.id] ? " processing" : ""}`}
                        type="button"
                        onClick={() => handleStartPreparing(order.id)}
                        disabled={processingOrders[order.id]}
                      >
                        {processingOrders[order.id] ? (
                          <>
                            <span className="material-symbols-outlined cd-animate-spin" style={{ fontSize: "16px" }}>
                              sync
                            </span>
                            Working
                          </>
                        ) : (
                          "Start Preparing"
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="cd-footer">
          <p>
            © 2026 Stratizen University Dining. System status:{" "}
            <span className="status">Operational</span>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default ChefDashboard;
