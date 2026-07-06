import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { supabase } from "../lib/supabase";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
import "../styles/PendingOrders.css";

// Helper to get initials from name
const getInitials = (name) => {
  if (!name) return "SO";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

// Cycle through different Material 3 badge colors based on ID
const getInitialsColorClass = (id) => {
  const classes = [
    { bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed" },
    { bg: "bg-primary-fixed", text: "text-on-primary-fixed" },
    { bg: "bg-surface-variant", text: "text-on-surface-variant" },
    { bg: "bg-secondary-fixed", text: "text-on-secondary-fixed" },
    { bg: "bg-primary-fixed-dim", text: "text-on-primary-fixed-variant" },
    { bg: "bg-tertiary-fixed-dim", text: "text-on-tertiary-fixed-variant" }
  ];
  const numId = typeof id === "number" ? id : parseInt(id.toString().replace(/\D/g, ""), 10) || 0;
  return classes[numId % classes.length];
};

// Format elapsed time (e.g., "2 mins ago")
const getElapsedTime = (placedAtString) => {
  if (!placedAtString) return "just now";
  const elapsedMs = Date.now() - new Date(placedAtString).getTime();
  const mins = Math.floor(elapsedMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} mins ago`;
};

function PendingOrders() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("newest"); // "newest" or "value"
  const [processingOrders, setProcessingOrders] = useState({});
  const [loading, setLoading] = useState(true);

  const loadPendingOrders = async () => {
    try {
      const { data: pendingData, error: fetchError } = await supabase
        .from("orders")
        .select("*, order_items(*, menu(*))")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      const mapped = (pendingData || []).map(o => ({
        id: o.id,
        name: o.student_name || "Student",
        items: (o.order_items || []).map(oi => `${oi.quantity}x ${oi.menu?.name || 'Meal'}`).join(", "),
        placedAt: o.created_at,
        total: parseFloat(o.total),
        itemsList: (o.order_items || []).map(oi => ({
          name: oi.menu?.name || "Meal",
          quantity: oi.quantity,
          price: parseFloat(oi.unit_price)
        }))
      }));

      setOrders(mapped);
    } catch (err) {
      console.error("Failed to load pending orders:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingOrders();

    // Subscribe to changes on the orders table in real-time
    const orderSubscription = supabase
      .channel("chef_pending_orders_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("Real-time update in pending orders");
          loadPendingOrders();
        }
      )
      .subscribe();

    // Refresh elapsed time labels every 30 seconds
    const interval = setInterval(() => {
      loadPendingOrders();
    }, 30000);

    return () => {
      orderSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleStartPreparing = async (orderId) => {
    setProcessingOrders(prev => ({ ...prev, [orderId]: true }));

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "preparing",
          prep_started_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Failed to start preparing order:", err.message);
      alert("Failed to update order status: " + err.message);
    } finally {
      setProcessingOrders(prev => {
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

  // Filter and sort orders
  const filteredOrders = orders
    .filter(order => {
      const query = searchTerm.toLowerCase();
      const nameMatch = order.name?.toLowerCase().includes(query);
      const idMatch = order.id?.toString().includes(query);
      const itemsMatch = order.items?.toLowerCase().includes(query);
      return nameMatch || idMatch || itemsMatch;
    })
    .sort((a, b) => {
      if (filterType === "value") {
        return b.total - a.total; // Highest value first
      }
      return new Date(b.placedAt) - new Date(a.placedAt); // Newest first
    });

  return (
    <div className="pending-orders-container text-on-background min-h-screen flex">

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
          <div className="flex items-center gap-md bg-secondary-container text-on-secondary-container rounded-lg px-md py-sm cursor-pointer shadow-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            <span className="font-label-lg text-label-lg">Order Queue</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high transition-all cursor-pointer rounded-lg" onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
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
                placeholder="Search orders by name or ID..."
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

          {/* Stats & Filter Row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary">Pending Orders</h2>
              <p className="text-on-surface-variant font-body-md">
                {loading ? "Loading orders..." : `You have ${orders.length} orders awaiting preparation.`}
              </p>
            </div>
            <div className="flex items-center gap-sm bg-surface-container-high p-xs rounded-lg">
              <button
                className={`px-md py-sm rounded-md font-label-lg transition-all border-none cursor-pointer ${filterType === "newest" ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:bg-surface/50"}`}
                type="button"
                onClick={() => setFilterType("newest")}
              >
                Newest
              </button>
              <button
                className={`px-md py-sm rounded-md font-label-lg transition-all border-none cursor-pointer ${filterType === "value" ? "bg-surface shadow-sm text-primary" : "text-on-surface-variant hover:bg-surface/50"}`}
                type="button"
                onClick={() => setFilterType("value")}
              >
                High Value
              </button>
            </div>
          </div>

          {/* Orders Bento Grid */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <span className="animate-spin material-symbols-outlined text-4xl text-primary">sync</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-xl bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant text-on-surface-variant gap-sm min-h-[300px]">
              <span className="material-symbols-outlined text-5xl text-secondary">done_all</span>
              <p className="font-title-lg text-on-surface">No Pending Orders</p>
              <p className="text-body-md text-center max-w-sm">All orders have been accepted. New student orders will appear here in real-time.</p>
            </div>
          ) : (
            <div className="order-grid">
              {filteredOrders.map((order) => {
                const colorScheme = getInitialsColorClass(order.id);
                const isNew = (Date.now() - new Date(order.placedAt).getTime()) < 300000;

                return (
                  <div key={order.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-md flex flex-col gap-md hover:shadow-md transition-all group order-card-transition">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-md">
                        <div className={`w-12 h-12 rounded-lg ${colorScheme.bg} flex items-center justify-center`}>
                          <span className={`${colorScheme.text} font-bold`}>{getInitials(order.name)}</span>
                        </div>
                        <div>
                          <h3 className="font-title-lg text-body-lg font-bold text-on-surface">{order.name}</h3>
                          <p className="text-xs text-on-surface-variant">Order #STR-{order.id.substring(0, 4).toUpperCase()} • {getElapsedTime(order.placedAt)}</p>
                        </div>
                      </div>
                      {isNew && (
                        <div className="bg-secondary-container/30 text-secondary px-sm py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                          New
                        </div>
                      )}
                    </div>

                    <div className="space-y-sm py-sm border-y border-outline-variant/20">
                      {order.itemsList.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-on-surface-variant">{item.quantity}x {item.name}</span>
                          <span className="font-medium text-on-surface">KES {item.price ? (item.price * item.quantity).toLocaleString() : ""}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-on-surface-variant font-medium">Total Amount</p>
                        <p className="text-primary font-bold text-title-lg">KES {order.total.toLocaleString()}</p>
                      </div>
                      <button
                        className={`bg-secondary text-on-secondary px-lg py-sm rounded-lg font-label-lg shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-sm border-none cursor-pointer ${processingOrders[order.id] ? "opacity-70 cursor-not-allowed" : ""}`}
                        type="button"
                        onClick={() => handleStartPreparing(order.id)}
                        disabled={processingOrders[order.id]}
                      >
                        {processingOrders[order.id] ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                            Preparing...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                            Start Preparing
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

export default PendingOrders;
