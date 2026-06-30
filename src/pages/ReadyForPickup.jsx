import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/ReadyForPickup.css";

// Helper to format simple elapsed time (e.g., "Ready 4m ago")
const formatReadyElapsed = (ms) => {
  if (ms < 0) return "Just ready";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just ready";
  return `Ready ${mins}m ago`;
};

function ReadyForPickup() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingCollected, setProcessingCollected] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [scanModal, setScanModal] = useState(null); // { orderId, studentName } or null

  // Keep current time ticking every second for elapsed timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load and sync ready orders from localStorage
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

      // Filter only ready orders
      const readyList = allOrders.filter(o => o.status === "ready");
      
      // Ensure readyAt is set
      const mappedList = readyList.map(o => {
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

        // If readyAt is missing, estimate it
        let readyAt = o.readyAt;
        if (!readyAt) {
          if (o.prepStartedAt) {
            readyAt = new Date(new Date(o.prepStartedAt).getTime() + 10 * 60000).toISOString();
          } else {
            readyAt = new Date(Date.now() - 120000).toISOString();
          }
        }

        return {
          ...o,
          itemsList,
          readyAt
        };
      });

      setOrders(mappedList);
      setLoading(false);
    };

    loadOrders();
    const interval = setInterval(loadOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkCollected = (orderId) => {
    setProcessingCollected(prev => ({ ...prev, [orderId]: true }));

    setTimeout(() => {
      const stored = localStorage.getItem("stratizen_chef_orders");
      if (stored) {
        try {
          const allOrders = JSON.parse(stored);
          const updated = allOrders.map(o => {
            if (o.id === orderId || o.id.toString() === orderId.toString()) {
              return { 
                ...o, 
                status: "collected",
                collectedAt: new Date().toISOString()
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
            activeOrder.status = "collected";
            activeOrder.simulatedStatus = "collected";
            localStorage.setItem("stratizen_active_order", JSON.stringify(activeOrder));
          }
        } catch (e) {
          console.error(e);
        }
      }

      setOrders(prev => prev.filter(o => o.id !== orderId));
      setProcessingCollected(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }, 800);
  };

  const handleQuickScan = () => {
    // If we have ready orders, scan the first one. Otherwise simulate a default scan.
    if (orders.length > 0) {
      const targetOrder = orders[0];
      setScanModal({
        orderId: targetOrder.id,
        studentName: targetOrder.name || "Marcus Thompson"
      });
    } else {
      setScanModal({
        orderId: "B-2033",
        studentName: "David Wilson"
      });
    }
  };

  const handleDismissScan = () => {
    if (scanModal && scanModal.orderId !== "B-2033") {
      handleMarkCollected(scanModal.orderId);
    }
    setScanModal(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  // Filter orders by search term (search by ID or student name)
  const filteredOrders = orders.filter(order => {
    const query = searchTerm.toLowerCase();
    const nameMatch = order.name?.toLowerCase().includes(query);
    const idMatch = order.id?.toString().includes(query);
    return nameMatch || idMatch;
  });

  return (
    <div className="ready-pickup-container text-on-surface min-h-screen flex">
      
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-50 border-r border-outline-variant bg-surface-container-low py-lg shrink-0">
        <div className="px-md mb-xl">
          <h1 className="text-headline-lg text-primary flex items-center gap-sm font-bold">
            <span className="material-symbols-outlined text-primary text-[28px]">restaurant</span>
            Stratizen Dining
          </h1>
          <p className="text-label-md text-on-surface-variant mt-xs">Chef Management Portal</p>
        </div>
        
        <nav className="flex-1 px-sm space-y-xs">
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-label-lg">Kitchen Dashboard</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="text-label-lg">Order Queue</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="text-label-lg">Menu Manager</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
            <span className="material-symbols-outlined">bar_chart</span>
            <span className="text-label-lg">Analytics</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
            <span className="material-symbols-outlined">groups</span>
            <span className="text-label-lg">Staff Settings</span>
          </div>
        </nav>
        
        <div className="px-sm space-y-xs">
          <button className="w-full text-left flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors border-none bg-transparent" type="button">
            <span className="material-symbols-outlined">help</span>
            <span className="text-label-lg">Help Center</span>
          </button>
          <button className="w-full text-left flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors border-none bg-transparent" type="button" onClick={handleLogout}>
            <span className="material-symbols-outlined text-error">logout</span>
            <span className="text-label-lg text-error">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="md:ml-64 min-h-screen flex-1 flex flex-col">
        
        {/* Top Navigation Header */}
        <header className="flex justify-between items-center px-lg sticky top-0 z-40 bg-surface/80 backdrop-blur-md shadow-sm h-16 w-full border-b border-outline-variant/30 shrink-0">
          <div className="flex items-center gap-md">
            <span className="md:hidden material-symbols-outlined text-primary cursor-pointer">menu</span>
          </div>
          <div className="flex items-center gap-lg">
            <div className="hidden sm:flex gap-md">
              <span className="text-on-surface-variant text-label-lg hover:text-primary cursor-pointer" onClick={() => navigate("/chef/dashboard")}>Dashboard</span>
              <span className="text-primary font-bold border-b-2 border-primary pb-1 text-label-lg cursor-default">Orders</span>
              <span className="text-on-surface-variant text-label-lg hover:text-primary cursor-pointer">Inventory</span>
            </div>
            <div className="flex items-center gap-md">
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">notifications</span>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer">settings</span>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant">
                <img alt="Chef Portrait" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0Mvt-Egr9Z5x2DULCN_4DGrxry3kmsV1_pv9IkMpaxqW0LRol3nPndNED_EM7sDRATQc-R3axIN6WQBkxhRTepkukDfyNVaoKaT7pg72C-W1kl3Iry7r_9yyRH-iwWNq7X2H3v4uowEKU-J46RXmrp1djJJYLEJ5E8tJt-TCexHp4tRTOb_66hXkuFYlc_mL1sB_VFHC5BnbiS5MLCXU6RQLdHvzK7Ms1K5HCb5OLpJaOzEtSZvaB5LA84rd24gu2m6P634mqUw" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-lg md:p-xl space-y-xl max-w-7xl mx-auto w-full flex-1 flex flex-col">
          
          {/* Title Banner & Stats */}
          <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md shrink-0">
            <div>
              <h2 className="text-headline-lg text-primary font-bold">Ready to Collect</h2>
              <p className="text-body-lg text-on-surface-variant">Manage order collections and QR scans for Stratizen students.</p>
            </div>
            <div className="flex gap-sm">
              <div className="bg-secondary-container text-on-secondary-container px-md py-sm rounded-lg shadow-sm">
                <div className="text-label-md">Active Pickups</div>
                <div className="text-title-lg font-bold">{orders.length}</div>
              </div>
              <div className="bg-surface-container-high text-on-surface px-md py-sm rounded-lg shadow-sm">
                <div className="text-label-md">Avg. Wait Time</div>
                <div className="text-title-lg font-bold">2m 45s</div>
              </div>
            </div>
          </section>

          {/* Grid Layout for Queue and Quick Collect */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg flex-1">
            
            {/* Queue List (Left 8 columns) */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="flex justify-between items-center mb-md">
                <h3 className="text-title-lg text-primary flex items-center gap-sm font-bold">
                  <span className="material-symbols-outlined">list_alt</span>
                  Queue
                </h3>
                <div className="flex items-center gap-sm border border-outline-variant rounded-full px-sm py-xs bg-surface shadow-sm">
                  <span className="material-symbols-outlined text-outline text-body-md">search</span>
                  <input 
                    className="bg-transparent border-none focus:ring-0 text-label-md py-0 outline-none" 
                    placeholder="Search order # or student..." 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <span className="animate-spin material-symbols-outlined text-4xl text-primary">sync</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-xl bg-surface rounded-xl border border-dashed border-outline-variant text-on-surface-variant gap-sm min-h-[300px]">
                  <span className="material-symbols-outlined text-5xl text-secondary">check_circle</span>
                  <p className="font-title-lg text-on-surface">No Orders Awaiting Pickup</p>
                  <p className="text-body-md text-center max-w-sm">Completed orders will appear here for collection. Students will be notified to scan their QR codes.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md" id="order-grid">
                  {filteredOrders.map(order => {
                    const elapsedMs = currentTime - new Date(order.readyAt).getTime();
                    
                    return (
                      <div key={order.id} className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between shadow-sm order-card-transition">
                        <div className="flex justify-between items-start mb-sm">
                          <div>
                            <span className="text-label-md text-primary bg-primary-fixed px-sm py-xs rounded uppercase tracking-wider font-bold">
                              #{order.id.toString().startsWith("STR") ? order.id : `STR-${order.id}`}
                            </span>
                            <h4 className="text-body-lg font-bold mt-sm text-on-surface">{order.name}</h4>
                            <p className="text-label-md text-on-surface-variant">{order.itemsList.length} {order.itemsList.length === 1 ? "item" : "items"} • {formatReadyElapsed(elapsedMs)}</p>
                          </div>
                          <div className="bg-secondary-container text-on-secondary-container w-10 h-10 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined">check_circle</span>
                          </div>
                        </div>
                        
                        <div className="space-y-xs mb-md text-label-md text-on-surface-variant border-t border-b border-outline-variant/20 py-sm">
                          {order.itemsList.map((item, index) => (
                            <div key={index} className="flex justify-between">
                              <span>{item.name}</span>
                              <span>x{item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        <button 
                          className={`w-full bg-secondary text-on-secondary text-label-lg py-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all border-none cursor-pointer flex items-center justify-center gap-sm ${processingCollected[order.id] ? "opacity-70 cursor-not-allowed" : ""}`}
                          type="button"
                          onClick={() => handleMarkCollected(order.id)}
                          disabled={processingCollected[order.id]}
                        >
                          {processingCollected[order.id] ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                              Collecting...
                            </>
                          ) : (
                            "Mark Collected"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Collect Section (Right 4 columns) */}
            <div className="lg:col-span-4">
              <div className="bg-primary text-on-primary rounded-2xl p-lg flex flex-col items-center text-center shadow-lg sticky top-24">
                <div className="mb-lg">
                  <span className="material-symbols-outlined text-[64px] mb-md block text-primary-fixed">qr_code_scanner</span>
                  <h3 className="text-headline-lg-mobile font-bold">Quick Collect</h3>
                  <p className="text-body-md text-primary-fixed opacity-90 mt-xs">Scan student QR code to instantly mark order as collected</p>
                </div>
                
                {/* QR Scanner Area */}
                <div 
                  className="w-full aspect-square bg-white/10 rounded-xl border-2 border-dashed border-primary-fixed-dim flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer" 
                  id="scan-trigger"
                  onClick={handleQuickScan}
                >
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary-fixed-dim"></div>
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary-fixed-dim"></div>
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary-fixed-dim"></div>
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary-fixed-dim"></div>
                  
                  {/* Glowing Laser Scan Line */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-secondary shadow-[0_0_15px_rgba(27,109,36,0.8)] animate-[scan_3s_ease-in-out_infinite] z-10"></div>
                  
                  <span className="material-symbols-outlined text-surface text-[48px] animate-pulse">photo_camera</span>
                  <span className="text-label-lg mt-sm text-primary-fixed">Awaiting Scan...</span>
                </div>
                
                <div className="mt-lg w-full flex flex-col gap-sm">
                  <button className="w-full bg-surface text-primary font-bold py-md rounded-xl hover:bg-surface-container-high transition-colors border-none cursor-pointer" type="button">Manual ID Entry</button>
                  <p className="text-label-md text-primary-fixed-dim opacity-70">Trouble scanning? Ensure camera lens is clean.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* QR Scan Success Modal Overlay */}
      {scanModal && (
        <div className="scan-modal-overlay fixed inset-0 z-[60] bg-primary flex items-center justify-center">
          <div className="text-center text-on-primary p-lg max-w-sm flex flex-col items-center">
            <span className="material-symbols-outlined text-[96px] text-secondary-container mb-md animate-bounce">check_circle</span>
            <h2 className="text-headline-lg font-bold">SCAN SUCCESSFUL</h2>
            <p className="text-title-lg mt-xs">Order #{scanModal.orderId.toString().startsWith("STR") ? scanModal.orderId : `STR-${scanModal.orderId}`} Verified</p>
            <p className="mt-md text-body-lg opacity-90">Student: {scanModal.studentName}</p>
            <button 
              id="close-scan" 
              className="mt-xl px-xl py-sm bg-surface text-primary rounded-full font-bold border-none cursor-pointer hover:bg-surface-container-high transition-colors active:scale-95"
              type="button"
              onClick={handleDismissScan}
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ReadyForPickup;
