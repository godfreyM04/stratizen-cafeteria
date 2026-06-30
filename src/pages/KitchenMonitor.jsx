import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
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

  // Load and sync preparing orders from localStorage
  useEffect(() => {
    const loadOrders = () => {
      let allOrders = [];
      const stored = localStorage.getItem("stratizen_chef_orders");
      if (stored) {
        try {
          allOrders = JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse chef orders:", e);
        }
      }

      // Check for active student orders in localStorage
      const activeOrderStr = localStorage.getItem("stratizen_active_order");
      if (activeOrderStr) {
        try {
          const activeOrder = JSON.parse(activeOrderStr);
          const exists = allOrders.some(o => o.id === activeOrder.id || o.id.toString() === activeOrder.id.toString());
          
          if (!exists && activeOrder.status !== "collected") {
            const formattedItems = activeOrder.items
              ? activeOrder.items.map(i => `${i.quantity}x ${i.name}`).join(", ")
              : "1x Custom Order";
              
            const newOrder = {
              id: activeOrder.id,
              name: activeOrder.items?.[0]?.name ? `${activeOrder.items[0].quantity}x ${activeOrder.items[0].name}` : "Student Order",
              items: formattedItems,
              time: "Placed just now",
              placedAt: activeOrder.placedAt || new Date().toISOString(),
              status: activeOrder.status || "pending",
              total: activeOrder.total || 0,
              itemsList: activeOrder.items || []
            };
            
            allOrders.unshift(newOrder);
            localStorage.setItem("stratizen_chef_orders", JSON.stringify(allOrders));
          } else if (exists) {
            // Update status in chef orders if active student order status changed
            allOrders = allOrders.map(o => {
              if (o.id === activeOrder.id || o.id.toString() === activeOrder.id.toString()) {
                return { ...o, status: activeOrder.status };
              }
              return o;
            });
          }
        } catch (e) {
          console.error("Failed to parse active student order:", e);
        }
      }

      // Filter only preparing orders
      const preparingList = allOrders.filter(o => o.status === "preparing");
      
      // Ensure prepStartedAt is set for tracking
      const mappedList = preparingList.map(o => {
        let itemsList = o.itemsList || [];
        if (itemsList.length === 0 && o.items) {
          const parts = o.items.split(", ");
          parts.forEach(part => {
            const match = part.match(/(\d+)x\s+(.+)/);
            if (match) {
              itemsList.push({ name: match[2], quantity: parseInt(match[1], 10) });
            }
          });
        }

        // If prepStartedAt is missing, estimate it based on placedAt
        let prepStartedAt = o.prepStartedAt;
        if (!prepStartedAt) {
          if (o.placedAt) {
            // Started 1 min after placed
            prepStartedAt = new Date(new Date(o.placedAt).getTime() + 60000).toISOString();
          } else {
            // Started 5 mins ago
            prepStartedAt = new Date(Date.now() - 300000).toISOString();
          }
        }

        return {
          ...o,
          itemsList,
          prepStartedAt
        };
      });

      setOrders(mappedList);
      setLoading(false);
    };

    loadOrders();
    const interval = setInterval(loadOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkReady = (orderId) => {
    setProcessingReady(prev => ({ ...prev, [orderId]: true }));

    setTimeout(() => {
      const stored = localStorage.getItem("stratizen_chef_orders");
      if (stored) {
        try {
          const allOrders = JSON.parse(stored);
          const updated = allOrders.map(o => {
            if (o.id === orderId || o.id.toString() === orderId.toString()) {
              return { 
                ...o, 
                status: "ready",
                readyAt: new Date().toISOString()
              };
            }
            return o;
          });
          localStorage.setItem("stratizen_chef_orders", JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
      }

      // Update the active student order if it matches
      const activeOrderStr = localStorage.getItem("stratizen_active_order");
      if (activeOrderStr) {
        try {
          const activeOrder = JSON.parse(activeOrderStr);
          if (activeOrder.id === orderId || activeOrder.id.toString() === orderId.toString()) {
            activeOrder.status = "ready";
            activeOrder.simulatedStatus = "ready";
            localStorage.setItem("stratizen_active_order", JSON.stringify(activeOrder));
          }
        } catch (e) {
          console.error(e);
        }
      }

      setOrders(prev => prev.filter(o => o.id !== orderId));
      setProcessingReady(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }, 8000); // Give it some simulated delay or make it fast. Wait, 800ms is perfect.
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

  // Split orders into Almost Ready (>= 5 mins) and In Preparation (< 5 mins)
  const almostReadyOrders = [];
  const inPrepOrders = [];

  filteredOrders.forEach(order => {
    const elapsedMs = currentTime - new Date(order.prepStartedAt).getTime();
    if (elapsedMs >= 300000) { // 5 minutes threshold
      almostReadyOrders.push(order);
    } else {
      inPrepOrders.push(order);
    }
  });

  return (
    <div className="kitchen-monitor-container text-on-background min-h-screen flex overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex flex-col py-lg z-50 shrink-0">
        <div className="px-lg mb-xl flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-[32px]">restaurant</span>
          <div>
            <h2 className="text-label-lg font-bold text-primary">Stratizen Dining</h2>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Chef Management</p>
          </div>
        </div>
        
        <nav className="flex-1 px-md space-y-1">
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all" onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-label-lg">Kitchen Dashboard</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="text-label-lg">Order Queue</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all">
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="text-label-lg">Menu Manager</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all">
            <span className="material-symbols-outlined">bar_chart</span>
            <span className="text-label-lg">Analytics</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all">
            <span className="material-symbols-outlined">groups</span>
            <span className="text-label-lg">Staff Settings</span>
          </div>
        </nav>
        
        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-1">
          <button className="w-full text-left flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-all border-none bg-transparent" type="button">
            <span className="material-symbols-outlined">help</span>
            <span className="text-label-lg">Help Center</span>
          </button>
          <button className="w-full text-left flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-all border-none bg-transparent" type="button" onClick={handleLogout}>
            <span className="material-symbols-outlined text-error">logout</span>
            <span className="text-label-lg text-error">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="ml-64 min-h-screen flex-1 flex flex-col overflow-hidden">
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-lg w-full sticky top-0 z-40 bg-surface/80 backdrop-blur-md shadow-sm h-16 border-b border-outline-variant/30 shrink-0">
          <div className="hidden md:flex flex-1 max-w-md mx-xl relative">
            <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input 
              className="w-full bg-surface-container rounded-full border-none pl-10 pr-md py-sm text-label-lg focus:ring-2 focus:ring-primary outline-none" 
              placeholder="Search orders..." 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-md ml-auto">
            <button className="p-sm text-on-surface-variant hover:text-primary transition-colors border-none bg-transparent"><span className="material-symbols-outlined">notifications</span></button>
            <button className="p-sm text-on-surface-variant hover:text-primary transition-colors border-none bg-transparent"><span className="material-symbols-outlined">settings</span></button>
            <img alt="User Profile" className="w-10 h-10 rounded-full border-2 border-outline-variant object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0Mvt-Egr9Z5x2DULCN_4DGrxry3kmsV1_pv9IkMpaxqW0LRol3nPndNED_EM7sDRATQc-R3axIN6WQBkxhRTepkukDfyNVaoKaT7pg72C-W1kl3Iry7r_9yyRH-iwWNq7X2H3v4uowEKU-J46RXmrp1djJJYLEJ5E8tJt-TCexHp4tRTOb_66hXkuFYlc_mL1sB_VFHC5BnbiS5MLCXU6RQLdHvzK7Ms1K5HCb5OLpJaOzEtSZvaB5LA84rd24gu2m6P634mqUw" />
          </div>
        </header>

        {/* Content Workspace */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-lg space-y-xl">
          <div className="flex items-center justify-between mb-lg shrink-0">
            <div>
              <h2 className="text-headline-lg text-on-background font-bold">Kitchen Live Monitor</h2>
              <p className="text-on-surface-variant text-label-lg">Real-time order tracking and status management</p>
            </div>
            <div className="bg-surface-container rounded-lg p-xs">
              <button className="px-md py-sm bg-surface text-primary rounded-md shadow-sm text-label-lg border-none cursor-default" type="button">Active View</button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <span className="animate-spin material-symbols-outlined text-4xl text-primary">sync</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-xl bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant text-on-surface-variant gap-sm min-h-[300px]">
              <span className="material-symbols-outlined text-5xl text-secondary">check_circle</span>
              <p className="font-title-lg text-on-surface">No Active Orders</p>
              <p className="text-body-md text-center max-w-sm">There are currently no orders in preparation. Start preparing new orders from the Order Queue.</p>
            </div>
          ) : (
            <div className="space-y-xl">
              
              {/* Status Section: Almost Ready */}
              {almostReadyOrders.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-md sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 border-b border-outline-variant/30">
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-secondary">check_circle</span>
                      <h3 className="text-title-lg font-bold">Almost Ready</h3>
                      <span className="bg-secondary-container text-on-secondary-container px-sm py-[2px] rounded-full text-label-md font-bold">
                        {almostReadyOrders.length} {almostReadyOrders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>
                    <span className="text-on-surface-variant text-label-md">Expected delivery &lt; 2m</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md">
                    {almostReadyOrders.map(order => {
                      const elapsedMs = currentTime - new Date(order.prepStartedAt).getTime();
                      const isCritical = elapsedMs >= 600000; // 10 minutes critical threshold

                      return (
                        <div 
                          key={order.id} 
                          className={`order-card-gradient border border-outline-variant rounded-xl p-md shadow-sm transition-all duration-300 ${
                            isCritical ? "critical-glow animate-pulse-slow border-error/50" : ""
                          }`}
                        >
                          <div className="flex justify-between items-start mb-md">
                            <h4 className="text-title-lg text-primary font-bold">#{order.id}</h4>
                            <span className={`font-bold text-label-md px-sm py-1 rounded-full ${
                              isCritical ? "text-error bg-error-container" : "text-on-surface-variant bg-surface-container-high"
                            }`}>
                              {formatDuration(elapsedMs)}
                            </span>
                          </div>
                          <div className="mb-lg">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Items</span>
                            <ul className="text-body-md space-y-1 font-medium">
                              {order.itemsList.map((item, index) => (
                                <li key={index}>• {item.quantity}x {item.name}</li>
                              ))}
                            </ul>
                          </div>
                          <button 
                            className="mark-ready w-full bg-secondary text-on-secondary py-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-label-lg text-white border-none cursor-pointer"
                            type="button"
                            onClick={() => handleMarkReady(order.id)}
                            disabled={processingReady[order.id]}
                          >
                            {processingReady[order.id] ? (
                              <>
                                <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                                Completing...
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[20px]">check_circle</span> 
                                Mark Ready
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Status Section: In Preparation */}
              {inPrepOrders.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-md sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 border-b border-outline-variant/30">
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-primary">soup_kitchen</span>
                      <h3 className="text-title-lg font-bold">In Preparation</h3>
                      <span className="bg-primary-container text-primary px-sm py-[2px] rounded-full text-label-md font-bold">
                        {inPrepOrders.length} {inPrepOrders.length === 1 ? "Order" : "Orders"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md pb-20">
                    {inPrepOrders.map(order => {
                      const elapsedMs = currentTime - new Date(order.prepStartedAt).getTime();

                      return (
                        <div key={order.id} className="order-card-gradient border border-outline-variant/50 rounded-xl p-md shadow-sm transition-all duration-300">
                          <div className="flex justify-between items-start mb-md">
                            <h4 className="text-title-lg text-primary font-bold">#{order.id}</h4>
                            <span className="text-on-surface-variant font-medium text-label-md">
                              {formatSimpleElapsed(elapsedMs)}
                            </span>
                          </div>
                          <div className="mb-lg">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Items</span>
                            <ul className="text-body-md space-y-1">
                              {order.itemsList.map((item, index) => (
                                <li key={index}>• {item.quantity}x {item.name}</li>
                              ))}
                            </ul>
                          </div>
                          <button 
                            className="mark-ready w-full bg-secondary text-on-secondary py-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-label-lg text-white border-none cursor-pointer"
                            type="button"
                            onClick={() => handleMarkReady(order.id)}
                            disabled={processingReady[order.id]}
                          >
                            {processingReady[order.id] ? (
                              <>
                                <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                                Completing...
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[20px]">check_circle</span> 
                                Mark Ready
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default KitchenMonitor;
