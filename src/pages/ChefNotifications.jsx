import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useToast } from "../context/ToastContext";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
import "../styles/ChefDashboard.css"; // Reuse dashboard styles for layout

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

      if (error) throw error;
      
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
    <div className="chef-dashboard-container text-on-background min-h-screen flex">
      {/* SideNavBar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container border-r border-outline-variant flex flex-col py-lg z-50">
        <div className="px-lg mb-xl">
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-3xl fill-icon">restaurant</span>
            <h1 className="font-headline-lg text-headline-lg text-primary font-bold leading-tight">Stratizen</h1>
          </div>
          <p className="font-label-md text-on-surface-variant opacity-70">Chef Management Portal</p>
        </div>
        
        <nav className="flex-1 px-md space-y-xs">
          <div className={`flex items-center gap-md rounded-lg px-md py-sm cursor-pointer duration-200 ${location.pathname === '/chef/dashboard' ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface hover:bg-surface-container-high'}`} onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-lg text-label-lg">Kitchen Dashboard</span>
          </div>
          <div className={`flex items-center gap-md rounded-lg px-md py-sm cursor-pointer duration-200 ${location.pathname === '/chef/menu' ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface hover:bg-surface-container-high'}`} onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="font-label-lg text-label-lg">Menu Manager</span>
          </div>
          <div className={`flex items-center gap-md rounded-lg px-md py-sm cursor-pointer duration-200 ${location.pathname === '/chef/pending' ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface hover:bg-surface-container-high'}`} onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="font-label-lg text-label-lg">Order Queue</span>
          </div>
          <div className={`flex items-center gap-md rounded-lg px-md py-sm cursor-pointer duration-200 ${location.pathname === '/chef/monitor' ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface hover:bg-surface-container-high'}`} onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
            <span className="font-label-lg text-label-lg">Kitchen Monitor</span>
          </div>
          <div className={`flex items-center gap-md rounded-lg px-md py-sm cursor-pointer duration-200 ${location.pathname === '/chef/ready' ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface hover:bg-surface-container-high'}`} onClick={() => navigate("/chef/ready")}>
            <span className="material-symbols-outlined">storefront</span>
            <span className="font-label-lg text-label-lg">Ready to Collect</span>
          </div>
          <div className={`flex items-center gap-md rounded-lg px-md py-sm cursor-pointer duration-200 ${location.pathname === '/chef/history' ? 'bg-secondary-container text-on-secondary-container font-medium' : 'text-on-surface hover:bg-surface-container-high'}`} onClick={() => navigate("/chef/history")}>
            <span className="material-symbols-outlined">history</span>
            <span className="font-label-lg text-label-lg">Order History</span>
          </div>
        </nav>
        
        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-xs">
          <ChefLogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen bg-surface">
        
        {/* TopAppBar */}
        <header className="w-full h-16 flex justify-between items-center px-lg bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-40 border-b border-outline-variant/20">
          <div className="flex items-center gap-lg">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">search</span>
              <input className="bg-surface-container border-none rounded-full pl-10 pr-lg py-sm text-body-md w-80 focus:ring-2 focus:ring-primary outline-none" placeholder="Search orders or items..." type="text" />
            </div>
          </div>
          
          <div className="flex items-center gap-md">
            <ChefNotificationCentre />
            <div className="h-8 w-[1px] bg-outline-variant mx-sm"></div>
            <div className="flex items-center gap-sm">
              <div className="text-right">
                <p className="font-label-lg text-label-lg text-on-surface">{profile?.full_name || "Chef"}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Executive Chef</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-title-lg">
                {(profile?.full_name || "C").charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-md md:p-lg overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-lg gap-md pt-md">
              <div>
                <h1 className="text-headline-lg text-primary font-bold">Notification Centre</h1>
                <p className="text-on-surface-variant text-body-md mt-1">Manage your daily kitchen and system notifications</p>
              </div>
              
              <button 
                className={`flex items-center justify-center gap-sm px-md py-sm rounded-lg border text-label-lg transition-colors cursor-pointer ${isMarkingAllRead ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-primary hover:bg-primary/5 bg-transparent'}`}
                onClick={markAllAsRead}
                disabled={isMarkingAllRead || unreadCount === 0}
                type="button"
              >
                {isMarkingAllRead ? (
                  <><span className="material-symbols-outlined text-[18px]">check</span> Done</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">done_all</span> Mark all as read</>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-md gap-y-lg pb-xl" id="notification-container">
              {pendingOrders.length === 0 ? (
                <div className="md:col-span-12 flex flex-col items-center justify-center py-xl text-center">
                  <span className="material-symbols-outlined text-outline text-[48px] mb-md opacity-50">notifications_paused</span>
                  <h3 className="text-title-lg text-on-surface font-medium">No active notifications</h3>
                  <p className="text-body-md text-on-surface-variant mt-sm">You're all caught up! New student orders will appear here instantly.</p>
                </div>
              ) : (
                pendingOrders.map(order => {
                  const isRead = readIds.includes(order.id);
                  const itemsSummary = (order.order_items || [])
                    .map(oi => `${oi.quantity}x ${oi.menu?.name || 'Item'}`)
                    .join(", ");
                    
                  const displayId = order.id.substring(0, 8).toUpperCase();

                  return (
                    <div 
                      key={order.id} 
                      className={`md:col-span-12 rounded-xl p-md flex gap-md group transition-all duration-300 relative ${isRead ? 'bg-white border border-outline-variant opacity-75' : 'bg-primary-container/10 border-l-4 border-primary animate-slide-in'}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary flex-shrink-0">
                        <span className="material-symbols-outlined">shopping_cart</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`text-title-lg font-bold ${isRead ? 'text-on-surface' : 'text-primary'}`}>New Order Received</h3>
                          <span className="text-label-md text-outline whitespace-nowrap ml-md pr-6 md:pr-0">{getElapsedTime(order.created_at)}</span>
                        </div>
                        <p className="text-body-md text-on-surface mb-md mt-xs">
                          Order <span className="font-bold">#STZ-{displayId}</span>: {itemsSummary}.
                        </p>
                        <div className="flex gap-sm">
                          <button 
                            className="bg-primary text-on-primary px-md py-sm rounded-lg text-label-md font-medium hover:opacity-90 transition-opacity border-none cursor-pointer active:scale-95"
                            onClick={() => handleStartPreparing(order.id)}
                            type="button"
                          >
                            Start Preparing
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
