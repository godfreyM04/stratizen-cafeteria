import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
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
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [scanModal, setScanModal] = useState(null); // { orderId, studentName } or null
  const [manualIdInput, setManualIdInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Keep current time ticking every second for elapsed timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadReadyOrders = async () => {
    try {
      const { data: readyData, error: fetchError } = await supabase
        .from("orders")
        .select("*, order_items(*, menu(*))")
        .eq("status", "ready")
        .order("ready_at", { ascending: true });

      if (fetchError) throw fetchError;

      const mapped = (readyData || []).map(o => ({
        id: o.id,
        name: o.student_name || "Student",
        items: (o.order_items || []).map(oi => `${oi.quantity}x ${oi.menu?.name || 'Meal'}`).join(", "),
        total: parseFloat(o.total),
        placedAt: o.created_at,
        readyAt: o.ready_at || o.created_at,
        itemsList: (o.order_items || []).map(oi => ({
          name: oi.menu?.name || "Meal",
          quantity: oi.quantity
        }))
      }));

      setOrders(mapped);
    } catch (err) {
      console.error("Failed to load ready orders:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReadyOrders();

    // Subscribe to changes on the orders table in real-time
    const orderSubscription = supabase
      .channel("chef_ready_orders_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("Real-time update in ready orders");
          loadReadyOrders();
        }
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, []);

  const handleMarkCollected = async (orderId) => {
    setProcessingCollected(prev => ({ ...prev, [orderId]: true }));

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "collected",
          collected_at: new Date().toISOString()
        })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(prev => prev.filter(o => o.id !== orderId));
      if (scanModal && scanModal.orderId === orderId) {
        setScanModal(null);
      }
    } catch (err) {
      console.error("Failed to mark order as collected:", err.message);
      alert("Failed to update order status: " + err.message);
    } finally {
      setProcessingCollected(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }
  };

  const handleManualCollect = async (e) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;

    // Try to find the order by ID match (fuzzy match from start or full ID)
    const match = orders.find(o => 
      o.id.toLowerCase().includes(manualIdInput.toLowerCase()) || 
      `STR-${o.id.substring(0, 4).toUpperCase()}`.includes(manualIdInput.toUpperCase())
    );

    if (match) {
      await handleMarkCollected(match.id);
      setManualIdInput("");
      setShowManualInput(false);
      alert("Order marked as collected successfully!");
    } else {
      alert("Order ID not found in the ready queue.");
    }
  };

  const handleQuickCollectScan = () => {
    if (orders.length === 0) {
      alert("No orders currently awaiting pickup.");
      return;
    }
    // Simulate scanning the first order in the queue
    const firstOrder = orders[0];
    setScanModal({ orderId: firstOrder.id, studentName: firstOrder.name });
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
    const orderNoMatch = `STR-${order.id.substring(0, 4).toUpperCase()}`.toLowerCase().includes(query);
    const itemsMatch = order.items?.toLowerCase().includes(query);
    return nameMatch || idMatch || orderNoMatch || itemsMatch;
  });

  // Calculate stats
  const activeCount = orders.length;
  // Calculate average wait time for ready orders
  const getAvgWaitTime = () => {
    if (orders.length === 0) return "0m 0s";
    const totalMs = orders.reduce((sum, o) => sum + (currentTime - new Date(o.readyAt).getTime()), 0);
    const avgMs = totalMs / orders.length;
    const avgMins = Math.floor(avgMs / 60000);
    const avgSecs = Math.floor((avgMs % 60000) / 1000);
    return `${avgMins}m ${avgSecs}s`;
  };

  return (
    <div className="ready-pickup-container text-on-background min-h-screen flex">

      {/* SideNavBar */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 z-50 border-r border-outline-variant bg-surface-container-low py-lg">
        <div className="px-md mb-xl">
          <h1 className="text-headline-lg text-primary flex items-center font-bold">
            <span className="material-symbols-outlined text-primary mr-sm" style={{ verticalAlign: "middle" }}>restaurant</span>
            Stratizen Dining
          </h1>
          <p className="text-label-md text-on-surface-variant mt-xs">Chef Management Portal</p>
        </div>

        <nav className="flex-grow px-sm space-y-xs">
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-label-lg">Kitchen Dashboard</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="text-label-lg">Menu Manager</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="text-label-lg">Order Queue</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
            <span className="text-label-lg">Kitchen Monitor</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg bg-secondary-container text-on-secondary-container cursor-pointer font-bold shadow-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>storefront</span>
            <span className="text-label-lg">Ready to Collect</span>
          </div>
          <div className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => navigate("/chef/history")}>
            <span className="material-symbols-outlined">history</span>
            <span className="text-label-lg">Order History</span>
          </div>
        </nav>

        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-xs">
          <ChefLogoutButton />
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="md:ml-64 min-h-screen flex flex-col flex-grow">
        
        {/* Top Header */}
        <header className="flex justify-between items-center px-lg sticky top-0 z-40 bg-surface/80 backdrop-blur-md shadow-sm h-16 w-full border-b border-outline-variant/30">
          <div className="flex items-center gap-md">
            <span className="md:hidden material-symbols-outlined text-primary cursor-pointer">menu</span>
          </div>
          
          <div className="flex items-center gap-lg">
            <div className="hidden sm:flex gap-md">
              <span className="text-on-surface-variant text-label-lg hover:text-primary cursor-pointer" onClick={() => navigate("/chef/dashboard")}>Dashboard</span>
              <span className="text-primary font-bold border-b-2 border-primary pb-1 text-label-lg cursor-pointer">Orders</span>
              <span className="text-on-surface-variant text-label-lg hover:text-primary cursor-pointer">Inventory</span>
            </div>
            
            <div className="flex items-center gap-md">
              <ChefNotificationCentre />
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant">
                <img alt="Chef Portrait" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0bxqxPZqyUHFKewPSzeVOhfZXM3wXTgeSuLRw-0oLynRHVEQ8XJbqmsp9aoThMiSFHWh1oDNYZs5s4Z6JKJVWpQTM8-HJ-h8gPioe7J9CwlkOt-Wt49Hab9DM509qMDq1ewjPsB07P23-boU3YxQRqY9vgWGP9aO4Q6Vn6Pu0e7t7LXm1QuJWGB-ngAWa1o4JsH6EreasRm8lWu_i1LbKffz3QQdAoYIqWRR1Y9Q1LMHCYJdrKTPPvmDndU2wpyvwJnpE3FbyBQ" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-lg md:p-xl space-y-xl max-w-7xl mx-auto w-full">
          
          {/* Headline & Stats Section */}
          <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-md">
            <div>
              <h2 className="text-headline-lg text-primary">Ready to Collect</h2>
              <p className="text-body-lg text-on-surface-variant">Manage order collections and QR scans for Stratizen students.</p>
            </div>
            <div className="flex gap-sm">
              <div className="bg-secondary-container text-on-secondary-container px-md py-sm rounded-lg">
                <div className="text-label-md">Active Pickups</div>
                <div className="text-title-lg font-bold">{activeCount}</div>
              </div>
              <div className="bg-surface-container-high text-on-surface px-md py-sm rounded-lg">
                <div className="text-label-md">Avg. Wait Time</div>
                <div className="text-title-lg font-bold">{getAvgWaitTime()}</div>
              </div>
            </div>
          </section>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            
            {/* Left Column: Queue List */}
            <div className="lg:col-span-8">
              
              <div className="flex justify-between items-center mb-md">
                <h3 className="text-title-lg text-primary flex items-center gap-sm">
                  <span className="material-symbols-outlined">list_alt</span>
                  Queue
                </h3>
                <div className="flex items-center gap-sm border border-outline-variant rounded-full px-sm py-xs bg-surface">
                  <span className="material-symbols-outlined text-outline text-body-md">search</span>
                  <input 
                    className="bg-transparent border-none focus:ring-0 text-label-md py-0 outline-none" 
                    placeholder="Search order #" 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center min-h-[250px]">
                  <span className="animate-spin material-symbols-outlined text-4xl text-primary">sync</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-xl bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant text-on-surface-variant gap-sm min-h-[250px]">
                  <span className="material-symbols-outlined text-5xl text-secondary">done_all</span>
                  <p className="font-title-lg text-on-surface">No Orders Awaiting Pickup</p>
                  <p className="text-body-md text-center max-w-sm">All prepared meals have been collected by students. Great job!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md" id="order-grid">
                  {filteredOrders.map((order) => {
                    const waitingMs = currentTime - new Date(order.readyAt).getTime();
                    const totalQty = order.itemsList.reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <div key={order.id} className="bg-surface border border-outline-variant rounded-xl p-md flex flex-col justify-between shadow-sm order-card-transition">
                        <div className="flex justify-between items-start mb-sm">
                          <div>
                            <span className="text-label-md text-primary bg-primary-fixed px-sm py-xs rounded uppercase tracking-wider">
                              #STR-{order.id.substring(0, 4).toUpperCase()}
                            </span>
                            <h4 className="text-body-lg font-bold mt-sm">{order.name}</h4>
                            <p className="text-label-md text-on-surface-variant">
                              {totalQty} item{totalQty !== 1 ? 's' : ''} • {formatReadyElapsed(waitingMs)}
                            </p>
                          </div>
                          <div className="bg-secondary-container text-on-secondary-container w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined">check_circle</span>
                          </div>
                        </div>

                        <div className="space-y-xs mb-md text-label-md text-on-surface-variant py-sm border-t border-b border-outline-variant/10">
                          {order.itemsList.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{item.name}</span>
                              <span>x{item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        <button 
                          className={`w-full bg-secondary text-on-secondary text-label-lg py-sm rounded-lg hover:opacity-90 active:scale-[0.98] transition-all mark-collected border-none cursor-pointer flex items-center justify-center gap-sm ${processingCollected[order.id] ? "opacity-70 cursor-not-allowed" : ""}`}
                          disabled={processingCollected[order.id]}
                          onClick={() => handleMarkCollected(order.id)}
                          type="button"
                        >
                          {processingCollected[order.id] ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                              Processing...
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

            {/* Right Column: Quick Collect Scan Sidebar */}
            <div className="lg:col-span-4">
              <div className="bg-primary text-on-primary rounded-2xl p-lg flex flex-col items-center text-center shadow-lg sticky top-24">
                
                <div className="mb-lg">
                  <span className="material-symbols-outlined text-[64px] mb-md block">qr_code_scanner</span>
                  <h3 className="text-headline-lg-mobile font-bold">Quick Collect</h3>
                  <p className="text-body-md text-primary-fixed opacity-90 mt-xs">Scan student QR code to instantly mark order as collected</p>
                </div>

                <div 
                  className="w-full aspect-square bg-white/10 rounded-xl border-2 border-dashed border-primary-fixed-dim flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer" 
                  id="scan-trigger"
                  onClick={handleQuickCollectScan}
                >
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary-fixed-dim"></div>
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary-fixed-dim"></div>
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary-fixed-dim"></div>
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary-fixed-dim"></div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-secondary shadow-[0_0_15px_rgba(27,109,36,0.8)] animate-[scan_3s_ease-in-out_infinite] z-10"></div>
                  <span className="material-symbols-outlined text-surface text-[48px] animate-pulse">photo_camera</span>
                  <span className="text-label-lg mt-sm">Awaiting Scan...</span>
                </div>

                <div className="mt-lg w-full flex flex-col gap-sm">
                  {showManualInput ? (
                    <form onSubmit={handleManualCollect} className="w-full flex flex-col gap-xs">
                      <input 
                        type="text" 
                        placeholder="Enter Order ID (e.g. STR-A1B2)" 
                        className="w-full px-md py-sm rounded-lg text-on-surface bg-surface border-none text-body-md placeholder:text-on-surface-variant/40 outline-none"
                        value={manualIdInput}
                        onChange={(e) => setManualIdInput(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-sm">
                        <button 
                          type="submit" 
                          className="flex-1 py-xs rounded bg-secondary text-on-secondary font-bold text-xs cursor-pointer border-none"
                        >
                          Submit
                        </button>
                        <button 
                          type="button" 
                          className="px-sm py-xs rounded bg-surface-variant text-on-surface font-bold text-xs cursor-pointer border-none"
                          onClick={() => { setShowManualInput(false); setManualIdInput(""); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button 
                      className="w-full bg-surface text-primary font-bold py-md rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer border-none"
                      onClick={() => setShowManualInput(true)}
                    >
                      Manual ID Entry
                    </button>
                  )}
                  <p className="text-label-md text-primary-fixed-dim opacity-70">Trouble scanning? Ensure camera lens is clean.</p>
                </div>

              </div>
            </div>

          </div>

        </div>
      </main>

      {/* QR Code Scanner Simulation Modal */}
      {scanModal && (
        <div 
          className="fixed inset-0 z-[60] bg-primary flex items-center justify-center p-md"
          onClick={() => setScanModal(null)}
        >
          <div 
            className="bg-surface text-on-surface rounded-2xl p-lg max-w-[450px] w-full text-center shadow-2xl relative border border-outline-variant/30"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined text-secondary text-[72px] mb-md animate-bounce block">check_circle</span>
            <h2 className="text-headline-lg font-bold text-primary mb-xs">SCAN SUCCESSFUL</h2>
            <p className="text-title-lg font-bold">Order #STR-{scanModal.orderId.substring(0, 4).toUpperCase()} Verified</p>
            <p className="text-body-lg text-on-surface-variant mt-sm">Student: <strong>{scanModal.studentName}</strong></p>
            
            <div className="mt-xl flex flex-col gap-sm">
              <button 
                className="w-full bg-secondary text-on-secondary py-md rounded-xl font-bold hover:opacity-90 active:scale-[0.98] transition-all border-none cursor-pointer"
                onClick={() => handleMarkCollected(scanModal.orderId)}
              >
                Confirm Collection
              </button>
              <button 
                className="w-full bg-surface-container-highest text-on-surface-variant py-md rounded-xl font-bold hover:bg-surface-container-high transition-colors border-none cursor-pointer"
                onClick={() => setScanModal(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ReadyForPickup;
