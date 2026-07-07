import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
import "../styles/ChefNotifications.css";

const getElapsedTime = (placedAtString) => {
  if (!placedAtString) return "Just now";
  const elapsedMs = Date.now() - new Date(placedAtString).getTime();
  const mins = Math.floor(elapsedMs / 60000);
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    if (hours === 1) return "1 hr ago";
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  }
  return `${mins} mins ago`;
};

export default function ChefNotifications() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  
  const [pendingOrders, setPendingOrders] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [, setTimeTick] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      const stored = localStorage.getItem(`chef_read_notifications_${profile.id}`);
      if (stored) {
        try {
          setReadIds(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse read notifications from localStorage");
        }
      }
    }
  }, [profile?.id]);

  const saveReadIds = (ids) => {
    setReadIds(ids);
    if (profile?.id) {
      localStorage.setItem(`chef_read_notifications_${profile.id}`, JSON.stringify(ids));
    }
  };

  const loadPendingOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, menu(*))")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingOrders(data || []);
    } catch (err) {
      console.error("Failed to load notifications:", err.message);
    }
  };

  useEffect(() => {
    loadPendingOrders();

    const orderSubscription = supabase
      .channel("chef_notifications_page_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadPendingOrders();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      setTimeTick(t => t + 1);
    }, 60000);

    return () => {
      orderSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleStartPreparing = async (orderId) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "preparing",
          assigned_chef_id: profile?.id
        })
        .eq("id", orderId);

      if (error) {
        const currentOrder = pendingOrders.find(o => o.id === orderId);
        const existingNotes = currentOrder?.notes || "";
        const updatedNotes = `ChefID:${profile?.id}` + (existingNotes ? ` | ${existingNotes}` : "");

        const { error: fallbackError } = await supabase
          .from("orders")
          .update({ 
            status: "preparing",
            notes: updatedNotes
          })
          .eq("id", orderId);

        if (fallbackError) throw fallbackError;
      }
      
      const displayId = orderId.substring(0, 8).toUpperCase();
      addToast(`Order #STZ-${displayId} is now being prepared!`);
      
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Failed to start preparing:", err.message);
      addToast("Failed to start preparing order.", "error");
    }
  };

  const markAllAsRead = () => {
    setIsMarkingAllRead(true);
    const allPendingIds = pendingOrders.map(o => o.id);
    const newReadIds = Array.from(new Set([...readIds, ...allPendingIds]));
    
    saveReadIds(newReadIds);
    setTimeout(() => setIsMarkingAllRead(false), 2000);
  };
  
  const dismissNotification = (orderId, e) => {
    e.stopPropagation();
    if (!readIds.includes(orderId)) {
      saveReadIds([...readIds, orderId]);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  const unreadCount = pendingOrders.filter(o => !readIds.includes(o.id)).length;

  return (
    <div className="chef-notifications-container">
      {/* SideNavBar */}
      <aside>
        <div className="cn-logo-area">
          <div className="cn-logo-icon">
            <span className="material-symbols-outlined fill-icon">restaurant</span>
          </div>
          <div>
            <h1 className="cn-chef-name" style={{ fontSize: "18px", fontWeight: "700", color: "var(--color-primary)" }}>Stratizen</h1>
            <p className="cn-chef-role" style={{ fontSize: "10px" }}>Chef Management</p>
          </div>
        </div>
        
        <nav className="cn-nav-menu">
          <a className={`cn-nav-item ${location.pathname === "/chef/dashboard" ? "active" : ""}`} onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="cn-nav-item-text">Kitchen Dashboard</span>
          </a>
          <a className={`cn-nav-item ${location.pathname === "/chef/menu" ? "active" : ""}`} onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="cn-nav-item-text">Menu Manager</span>
          </a>
          <a className={`cn-nav-item ${location.pathname === "/chef/pending" ? "active" : ""}`} onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="cn-nav-item-text">Order Queue</span>
          </a>
          <a className={`cn-nav-item ${location.pathname === "/chef/monitor" ? "active" : ""}`} onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
            <span className="cn-nav-item-text">Kitchen Monitor</span>
          </a>
          <a className={`cn-nav-item ${location.pathname === "/chef/ready" ? "active" : ""}`} onClick={() => navigate("/chef/ready")}>
            <span className="material-symbols-outlined">storefront</span>
            <span className="cn-nav-item-text">Ready to Collect</span>
          </a>
          <a className={`cn-nav-item ${location.pathname === "/chef/history" ? "active" : ""}`} onClick={() => navigate("/chef/history")}>
            <span className="material-symbols-outlined">history</span>
            <span className="cn-nav-item-text">Order History</span>
          </a>
        </nav>
        
        <div style={{ padding: "0 16px", marginTop: "auto" }}>
          <ChefLogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main>
        {/* TopAppBar */}
        <header>
          <div className="cn-topbar-left">
            <div className="cn-search-wrapper">
              <span className="material-symbols-outlined cn-search-icon">search</span>
              <input className="cn-search-input" placeholder="Search orders or items..." type="text" />
            </div>
          </div>
          
          <div className="cn-topbar-right">
            <ChefNotificationCentre />
            <div style={{ width: "1px", height: "32px", backgroundColor: "var(--color-outline-variant)", margin: "0 8px" }}></div>
            <div className="cn-chef-profile-info">
              <div className="cn-chef-profile-text">
                <p className="cn-chef-name">{profile?.full_name || "Chef"}</p>
                <p className="cn-chef-role">Executive Chef</p>
              </div>
              <div className="cn-chef-avatar">
                {(profile?.full_name || "C").charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="cn-page-content">
          <div className="cn-header-row">
            <div>
              <h1 className="cn-title">Notification Centre</h1>
              <p className="cn-subtitle">Manage your daily kitchen and system notifications</p>
            </div>
            
            <button 
              className="cn-mark-read-btn"
              onClick={markAllAsRead}
              disabled={isMarkingAllRead || unreadCount === 0}
              type="button"
            >
              {isMarkingAllRead ? "Done" : "Mark all as read"}
            </button>
          </div>

          <div className="cn-list" id="notification-container">
            {pendingOrders.length === 0 ? (
              <div className="cn-empty-state">
                <span className="material-symbols-outlined cn-empty-icon">notifications_paused</span>
                <h3 className="cn-empty-title">No active notifications</h3>
                <p className="cn-empty-desc">You're all caught up! New student orders will appear here instantly.</p>
              </div>
            ) : (
              pendingOrders.map(order => {
                const isRead = readIds.includes(order.id);
                const itemsSummary = (order.order_items || [])
                  .map(oi => `${oi.quantity}x ${oi.menu?.name || "Item"}`)
                  .join(", ");
                  
                const displayId = order.id.substring(0, 8).toUpperCase();

                return (
                  <div 
                    key={order.id} 
                    className={`cn-card ${isRead ? "read" : ""}`}
                  >
                    <div className="cn-card-icon">
                      <span className="material-symbols-outlined">shopping_cart</span>
                    </div>
                    <div className="cn-card-content">
                      <div className="cn-card-header">
                        <h3 className={`cn-card-title ${isRead ? "read" : ""}`}>New Order Received</h3>
                        <span className="cn-card-time">{getElapsedTime(order.created_at)}</span>
                      </div>
                      <p className="cn-card-text">
                        Order <span style={{ fontWeight: "700" }}>#STZ-{displayId}</span>: {itemsSummary}.
                      </p>
                      {!isRead && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            className="cn-prep-btn"
                            onClick={() => handleStartPreparing(order.id)}
                            type="button"
                          >
                            Start Preparing
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
