import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
import "../styles/KitchenMonitor.css";

// Helper to format ticking duration (e.g., "18m 42s")
const formatDuration = (ms) => {
  if (ms < 0) return "00m 00s";
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
};

// Helper to format simple elapsed time (e.g., "6m ago")
const formatSimpleElapsed = (ms) => {
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  return `${mins}m ago`;
};

function KitchenMonitor() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingReady, setProcessingReady] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Keep current time ticking every second for the timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadPreparingOrders = async () => {
    try {
      const { data: preparingData, error: fetchError } = await supabase
        .from("orders")
        .select("*, order_items(*, menu(*))")
        .eq("status", "preparing")
        .order("prep_started_at", { ascending: true });

      if (fetchError) throw fetchError;

      const mapped = (preparingData || []).map(o => ({
        id: o.id,
        name: o.student_name || "Student",
        items: (o.order_items || []).map(oi => `${oi.quantity}x ${oi.menu?.name || 'Meal'}`).join(", "),
        placedAt: o.created_at,
        prepStartedAt: o.prep_started_at || o.created_at,
        itemsList: (o.order_items || []).map(oi => ({
          name: oi.menu?.name || "Meal",
          quantity: oi.quantity
        }))
      }));

      setOrders(mapped);
    } catch (err) {
      console.error("Failed to load preparing orders:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreparingOrders();

    // Subscribe to changes on the orders table in real-time
    const orderSubscription = supabase
      .channel("chef_preparing_orders_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("Real-time update in preparing orders");
          loadPreparingOrders();
        }
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, []);

  const handleMarkReady = async (orderId) => {
    setProcessingReady(prev => ({ ...prev, [orderId]: true }));

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "ready",
          ready_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Failed to mark order as ready:", err.message);
      alert("Failed to update order status: " + err.message);
    } finally {
      setProcessingReady(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
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

  // Filter orders by search term
  const filteredOrders = orders.filter(order => {
    const query = searchTerm.toLowerCase();
    const nameMatch = order.name?.toLowerCase().includes(query);
    const idMatch = order.id?.toString().includes(query);
    const itemsMatch = order.items?.toLowerCase().includes(query);
    return nameMatch || idMatch || itemsMatch;
  });

  // Calculate statistics for the top banner
  const activeCount = orders.length;
  const overdueCount = orders.filter(o => (currentTime - new Date(o.prepStartedAt).getTime()) > 900000).length; // Over 15 mins

  return (
    <div className="kitchen-monitor-container text-on-background min-h-screen flex">

      {/* SideNavBar */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex flex-col py-lg z-50">
        <div className="px-md mb-xl">
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Stratizen</h1>
          <p className="text-on-surface-variant font-label-md mt-xs">Chef Management Portal</p>
        </div>

        <nav className="flex-1 flex flex-col gap-xs px-sm">
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer rounded-lg" onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-lg text-label-lg">Kitchen Dashboard</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer rounded-lg" onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="font-label-lg text-label-lg">Menu Manager</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer rounded-lg" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="font-label-lg text-label-lg">Order Queue</span>
          </div>
          <div className="flex items-center gap-md bg-secondary-container text-on-secondary-container rounded-lg px-md py-sm cursor-pointer shadow-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>soup_kitchen</span>
            <span className="font-label-lg text-label-lg">Kitchen Monitor</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer rounded-lg" onClick={() => navigate("/chef/ready")}>
            <span className="material-symbols-outlined">storefront</span>
            <span className="font-label-lg text-label-lg">Ready to Collect</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer rounded-lg" onClick={() => navigate("/chef/history")}>
            <span className="material-symbols-outlined">history</span>
            <span className="font-label-lg text-label-lg">Order History</span>
          </div>
        </nav>

        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-xs">
          <ChefLogoutButton />
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="ml-64 min-h-screen flex flex-col flex-1">

        {/* Top Navigation Bar */}
        <header className="w-full h-16 bg-surface/80 backdrop-blur-md shadow-sm flex justify-between items-center px-lg sticky top-0 z-40 border-b border-outline-variant/30">
          <div className="flex items-center gap-xl flex-1">
            <div className="flex items-center bg-surface-container rounded-full px-md py-xs w-full max-w-md border border-outline-variant/50 focus-within:border-primary transition-all">
              <span className="material-symbols-outlined text-on-surface-variant mr-sm">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 w-full text-body-md placeholder:text-on-surface-variant/60 outline-none"
                placeholder="Search preparing tickets..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-lg">
            <ChefNotificationCentre />
            <div className="flex items-center gap-md">
              <div className="text-right hidden sm:block">
                <p className="font-label-lg text-label-lg text-on-surface">Chef Anderson</p>
                <p className="text-xs text-on-surface-variant">Main Canteen</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-primary overflow-hidden">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0Mvt-Egr9Z5x2DULCN_4DGrxry3kmsV1_pv9IkMpaxqW0LRol3nPndNED_EM7sDRATQc-R3axIN6WQBkxhRTepkukDfyNVaoKaT7pg72C-W1kl3Iry7r_9yyRH-iwWNq7X2H3v4uowEKU-J46RXmrp1djJJYLEJ5E8tJt-TCexHp4tRTOb_66hXkuFYlc_mL1sB_VFHC5BnbiS5MLCXU6RQLdHvzK7Ms1K5HCb5OLpJaOzEtSZvaB5LA84rd24gu2m6P634mqUw" alt="Chef Anderson" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <section className="p-lg lg:p-xl space-y-lg flex-1">

          {/* Stats Bar */}
          <div className="flex flex-wrap justify-between items-center gap-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary">Live Kitchen Monitor</h2>
              <p className="text-on-surface-variant font-body-md">Monitor and expedite orders currently in preparation.</p>
            </div>
            
            <div className="flex items-center gap-md">
              <div className="bg-surface-container-lowest border border-outline-variant/30 px-lg py-sm rounded-xl flex items-center gap-md">
                <span className="material-symbols-outlined text-primary text-3xl">soup_kitchen</span>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase font-bold">Active Preparations</p>
                  <p className="text-xl font-bold text-on-surface">{activeCount} Orders</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/30 px-lg py-sm rounded-xl flex items-center gap-md">
                <span className={`material-symbols-outlined text-3xl ${overdueCount > 0 ? "text-error animate-pulse" : "text-secondary"}`}>warning</span>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase font-bold">Overdue (&gt;15m)</p>
                  <p className={`text-xl font-bold ${overdueCount > 0 ? "text-error" : "text-on-surface"}`}>{overdueCount} Orders</p>
                </div>
              </div>
            </div>
          </div>

          {/* Preparing Bento Grid */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <span className="animate-spin material-symbols-outlined text-4xl text-primary">sync</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-xl bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant text-on-surface-variant gap-sm min-h-[300px]">
              <span className="material-symbols-outlined text-5xl text-secondary">done_all</span>
              <p className="font-title-lg text-on-surface">No Orders in Preparation</p>
              <p className="text-body-md text-center max-w-sm">There are no orders being prepared right now. Start preparing new orders from the Order Queue.</p>
            </div>
          ) : (
            <div className="order-grid">
              {filteredOrders.map((order) => {
                const elapsedMs = currentTime - new Date(order.prepStartedAt).getTime();
                const totalElapsedMs = currentTime - new Date(order.placedAt).getTime();
                const isOverdue = elapsedMs > 900000; // 15 minutes

                return (
                  <div key={order.id} className={`bg-surface-container-lowest border rounded-xl p-md flex flex-col gap-md hover:shadow-md transition-all group order-card-transition ${isOverdue ? "border-error/50 bg-error-container/5" : "border-outline-variant/30"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-title-lg text-body-lg font-bold text-on-surface">{order.name}</h3>
                        <p className="text-xs text-on-surface-variant">Order #STR-{order.id.substring(0, 4).toUpperCase()} • {formatSimpleElapsed(totalElapsedMs)}</p>
                      </div>
                      
                      {/* Timer */}
                      <div className={`flex items-center gap-xs px-sm py-1 rounded-full text-xs font-bold ${isOverdue ? "bg-error text-on-error" : "bg-primary-container text-on-primary-container"}`}>
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>{formatDuration(elapsedMs)}</span>
                      </div>
                    </div>

                    {/* Food Items list */}
                    <div className="space-y-sm py-sm border-y border-outline-variant/20 flex-1">
                      {order.itemsList.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-on-surface font-medium">{item.quantity}x {item.name}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-xs">
                      <span className="text-xs text-on-surface-variant">
                        Prep started {formatSimpleElapsed(elapsedMs)}
                      </span>
                      <button
                        className={`bg-primary text-on-primary px-lg py-sm rounded-lg font-label-lg shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-sm border-none cursor-pointer ${processingReady[order.id] ? "opacity-70 cursor-not-allowed" : ""}`}
                        type="button"
                        onClick={() => handleMarkReady(order.id)}
                        disabled={processingReady[order.id]}
                      >
                        {processingReady[order.id] ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                            Updating...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">check</span>
                            Mark Ready
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default KitchenMonitor;
