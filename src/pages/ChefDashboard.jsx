import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/ChefDashboard.css";

// Helper to generate realistic initial orders if localStorage is empty
const generateInitialOrders = () => {
  const orders = [];
  const now = new Date();
  
  // 1. Add 4 mock pending orders (matching the Stitch design exactly)
  orders.push(
    {
      id: 2481,
      name: "Sarah Jenkins",
      items: "1x Grilled Salmon Bowl, 1x Iced Matcha",
      time: "Placed 2m ago",
      placedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      status: "pending"
    },
    {
      id: 2482,
      name: "Marcus Thorne",
      items: "2x Spicy Tofu Ramen (Extra Spice)",
      time: "Placed 5m ago",
      placedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      status: "pending"
    },
    {
      id: 2483,
      name: "Elena Rodriguez",
      items: "1x Chicken Caesar Salad, 1x Garlic Bread",
      time: "Placed 8m ago",
      placedAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
      status: "pending"
    },
    {
      id: 2484,
      name: "Jordan Wu",
      items: "3x Falafel Wraps, 3x Hummus Sides",
      time: "Placed 12m ago",
      placedAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
      status: "pending"
    }
  );

  // 2. Add 8 preparing orders
  for (let i = 0; i < 8; i++) {
    orders.push({
      id: 2470 - i,
      name: `Preparing Student ${i + 1}`,
      items: "1x Meal",
      placedAt: new Date(now.getTime() - (15 + i * 2) * 60 * 1000).toISOString(),
      status: "preparing"
    });
  }

  // 3. Add 5 ready orders
  for (let i = 0; i < 5; i++) {
    orders.push({
      id: 2460 - i,
      name: `Ready Student ${i + 1}`,
      items: "1x Meal",
      placedAt: new Date(now.getTime() - (25 + i * 3) * 60 * 1000).toISOString(),
      status: "ready"
    });
  }

  // 4. Add 142 completed orders distributed across peak hours today
  const distributions = [
    { startHour: 8, endHour: 10, count: 12 },
    { startHour: 10, endHour: 12, count: 22 },
    { startHour: 12, endHour: 14, count: 45 },
    { startHour: 14, endHour: 16, count: 20 },
    { startHour: 16, endHour: 18, count: 33 },
    { startHour: 18, endHour: 20, count: 10 }
  ];

  let idCounter = 2300;
  distributions.forEach(({ startHour, endHour, count }) => {
    for (let i = 0; i < count; i++) {
      const orderDate = new Date(now);
      orderDate.setHours(startHour);
      orderDate.setMinutes(Math.floor(Math.random() * 60));
      orders.push({
        id: idCounter++,
        name: "Completed Student",
        items: "1x Meal",
        placedAt: orderDate.toISOString(),
        status: "completed"
      });
    }
  });

  return orders;
};

function ChefDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    pending: 12,
    preparing: 8,
    ready: 5,
    completed: 142
  });

  const [orders, setOrders] = useState([]);
  const [processingOrders, setProcessingOrders] = useState({});

  // Sync with localStorage
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
      } else {
        allOrders = generateInitialOrders();
        localStorage.setItem("stratizen_chef_orders", JSON.stringify(allOrders));
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
              status: activeOrder.status || "pending"
            };
            
            allOrders.unshift(newOrder);
            localStorage.setItem("stratizen_chef_orders", JSON.stringify(allOrders));
          }
        } catch (e) {
          console.error("Failed to parse active student order:", e);
        }
      }

      // Update pending orders list for the queue
      const pendingList = allOrders.filter(o => o.status === "pending" || o.status === "received");
      setOrders(pendingList);

      // Compute statistics dynamically
      const pendingCount = allOrders.filter(o => o.status === "pending" || o.status === "received" || o.status === "confirmed").length;
      const preparingCount = allOrders.filter(o => o.status === "preparing").length;
      const readyCount = allOrders.filter(o => o.status === "ready").length;
      const completedCount = allOrders.filter(o => o.status === "completed").length;

      setStats({
        pending: pendingCount,
        preparing: preparingCount,
        ready: readyCount,
        completed: completedCount
      });
    };

    loadOrders();
    const interval = setInterval(loadOrders, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStartPreparing = (orderId) => {
    setProcessingOrders(prev => ({ ...prev, [orderId]: true }));

    setTimeout(() => {
      const stored = localStorage.getItem("stratizen_chef_orders");
      if (stored) {
        try {
          const allOrders = JSON.parse(stored);
          const updated = allOrders.map(o => {
            if (o.id === orderId || o.id.toString() === orderId.toString()) {
              return { ...o, status: "preparing" };
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
            activeOrder.status = "preparing";
            activeOrder.simulatedStatus = "preparing";
            localStorage.setItem("stratizen_active_order", JSON.stringify(activeOrder));
          }
        } catch (e) {
          console.error(e);
        }
      }

      setProcessingOrders(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
    }, 1000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  // Group completed orders by peak hours dynamically
  const getGraphData = () => {
    const counts = [0, 0, 0, 0, 0, 0]; // 8-10, 10-12, 12-14, 14-16, 16-18, 18-20
    const stored = localStorage.getItem("stratizen_chef_orders");
    if (!stored) return counts;
    
    try {
      const allOrders = JSON.parse(stored);
      const today = new Date().toDateString();
      
      allOrders.forEach(o => {
        if (o.status !== "completed") return;
        
        const date = new Date(o.placedAt);
        if (date.toDateString() !== today) return;
        
        const hour = date.getHours();
        if (hour >= 8 && hour < 10) counts[0]++;
        else if (hour >= 10 && hour < 12) counts[1]++;
        else if (hour >= 12 && hour < 14) counts[2]++;
        else if (hour >= 14 && hour < 16) counts[3]++;
        else if (hour >= 16 && hour < 18) counts[4]++;
        else if (hour >= 18 && hour < 20) counts[5]++;
      });
    } catch (e) {
      console.error("Failed to compute graph data:", e);
    }
    
    return counts;
  };

  const graphCounts = getGraphData();
  const maxCount = Math.max(...graphCounts, 1);

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
          <div className="flex items-center gap-md bg-secondary-container text-on-secondary-container rounded-lg px-md py-sm cursor-pointer duration-200">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-lg text-label-lg">Kitchen Dashboard</span>
          </div>
          <div className="flex items-center gap-md text-on-surface px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all duration-200" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="font-label-lg text-label-lg">Order Queue</span>
          </div>
          <div className="flex items-center gap-md text-on-surface px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all duration-200">
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="font-label-lg text-label-lg">Menu Manager</span>
          </div>
          <div className="flex items-center gap-md text-on-surface px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all duration-200">
            <span className="material-symbols-outlined">bar_chart</span>
            <span className="font-label-lg text-label-lg">Analytics</span>
          </div>
          <div className="flex items-center gap-md text-on-surface px-md py-sm hover:bg-surface-container-high rounded-lg cursor-pointer transition-all duration-200">
            <span className="material-symbols-outlined">groups</span>
            <span className="font-label-lg text-label-lg">Staff Settings</span>
          </div>
        </nav>
        
        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-xs">
          <button className="w-full text-left flex items-center gap-md text-on-surface px-md py-sm hover:bg-surface-container-high rounded-lg transition-all" type="button">
            <span className="material-symbols-outlined">help</span>
            <span className="font-label-lg text-label-lg">Help Center</span>
          </button>
          <button className="w-full text-left flex items-center gap-md text-error px-md py-sm hover:bg-error-container/20 rounded-lg transition-all" type="button" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span className="font-label-lg text-label-lg">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        
        {/* TopAppBar */}
        <header className="w-full h-16 flex justify-between items-center px-lg bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-lg">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">search</span>
              <input className="bg-surface-container border-none rounded-full pl-10 pr-lg py-sm text-body-md w-80 focus:ring-2 focus:ring-primary" placeholder="Search orders or items..." type="text" />
            </div>
          </div>
          
          <div className="flex items-center gap-md">
            <button className="p-sm text-on-surface-variant hover:bg-surface-container rounded-full transition-colors relative" type="button">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button className="p-sm text-on-surface-variant hover:bg-surface-container rounded-full transition-colors" type="button">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="h-8 w-[1px] bg-outline-variant mx-sm"></div>
            <div className="flex items-center gap-sm">
              <div className="text-right">
                <p className="font-label-lg text-label-lg text-on-surface">Chef Anderson</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Executive Chef</p>
              </div>
              <img className="w-10 h-10 rounded-full border-2 border-primary-fixed shadow-sm object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEcZCcEVpXa-MozwkTjzFQVIHYcYYM5akFrOMnj_D_vvqsfynOXdhbY75zobj4CTHb8jYUJoC-1tpYQLa3RrbBnwrmwvylrIRJ_DJaBLS0lAmOCvpaGz6Yafdw53X1sisa6nnDEP2oGCk-aWh3JpRv1hVf50hHdfL5KXrrmZUK_mfWAhSiVkP7MZSX602-XhGAL5NA-z_LKpjE3Vw5ipDGT703O6ivUTY1IMLDg-VhuvorjqcnwiYPMzJbhgmGsdbxAOJjYc9I_g" alt="Chef Anderson avatar" />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-lg space-y-lg max-w-[1600px] mx-auto w-full">
          
          {/* Summary Bento Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
            {/* Pending */}
            <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border-l-4 border-[#F57C00] flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/chef/pending")}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-lg text-on-surface-variant">Pending Orders</p>
                  <h2 className="font-headline-lg text-headline-lg text-[#F57C00]">{stats.pending < 10 ? `0${stats.pending}` : stats.pending}</h2>
                </div>
                <span className="material-symbols-outlined text-[#F57C00] bg-[#FFF3E0] p-sm rounded-lg">pending_actions</span>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-md flex items-center gap-xs">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                2 new in the last 5 mins
              </p>
            </div>

            {/* Preparing */}
            <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border-l-4 border-primary flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-lg text-on-surface-variant">Preparing</p>
                  <h2 className="font-headline-lg text-headline-lg text-primary">{stats.preparing < 10 ? `0${stats.preparing}` : stats.preparing}</h2>
                </div>
                <span className="material-symbols-outlined text-primary bg-primary-fixed p-sm rounded-lg">chef_hat</span>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-md flex items-center gap-xs">
                Avg. time: 14 mins
              </p>
            </div>

            {/* Ready */}
            <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border-l-4 flex flex-col justify-between hover:shadow-md transition-shadow border-outline-variant">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-lg text-on-surface-variant">Ready to Collect</p>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface-variant">{stats.ready < 10 ? `0${stats.ready}` : stats.ready}</h2>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant bg-surface-container-high p-sm rounded-lg">hourglass_empty</span>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-md">Awaiting student pickup</p>
            </div>

            {/* Completed */}
            <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border-l-4 flex flex-col justify-between hover:shadow-md transition-shadow border-secondary">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-lg text-on-surface-variant">Completed</p>
                  <h2 className="font-headline-lg text-headline-lg text-secondary">{stats.completed}</h2>
                </div>
                <span className="material-symbols-outlined text-secondary bg-secondary-fixed p-sm rounded-lg">check_circle</span>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-md flex items-center gap-xs">
                Goal: 200 orders
              </p>
            </div>
          </section>

          {/* Main Operational Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            
            {/* Incoming Orders List */}
            <section className="lg:col-span-2 space-y-md">
              <div className="flex justify-between items-center px-xs">
                <h3 className="font-title-lg text-title-lg text-on-surface">Incoming Orders</h3>
                <button className="text-primary font-label-lg flex items-center gap-xs hover:underline" type="button">
                  View All Queue <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
              
              <div className="space-y-sm">
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-xl bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant text-on-surface-variant gap-sm">
                    <span className="material-symbols-outlined text-4xl text-secondary">done_all</span>
                    <p className="font-body-md">All orders have been prepared!</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="bg-white p-md rounded-xl shadow-sm border border-outline-variant/30 flex items-center justify-between group hover:border-primary/50 order-card-transition">
                      <div className="flex items-center gap-lg">
                        <div className="bg-surface-container p-sm rounded-lg text-center min-w-[60px]">
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold">Ticket</p>
                          <p className="text-primary font-bold text-lg">#{order.id}</p>
                        </div>
                        <div>
                          <h4 className="font-label-lg text-on-surface text-base">{order.name}</h4>
                          <p className="text-body-md text-on-surface-variant">{order.items}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-lg">
                        <div className="text-right">
                          <p className="text-label-md text-on-surface-variant">{order.time}</p>
                        </div>
                        <button 
                          className={`bg-secondary text-on-secondary px-lg py-sm rounded-lg font-label-lg hover:shadow-lg transition-all active:scale-95 flex items-center justify-center ${processingOrders[order.id] ? 'opacity-70 cursor-not-allowed' : ''}`}
                          type="button"
                          onClick={() => handleStartPreparing(order.id)}
                          disabled={processingOrders[order.id]}
                        >
                          {processingOrders[order.id] ? (
                            <span className="flex items-center gap-xs">
                              <span className="animate-spin material-symbols-outlined text-sm">sync</span>
                              Processing
                            </span>
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

            {/* Activity Chart & Kitchen Stats */}
            <section className="space-y-lg">
              <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/30 h-full flex flex-col">
                <div className="flex justify-between items-center mb-lg">
                  <h3 className="font-title-lg text-title-lg text-on-surface">Peak Activity</h3>
                  <span className="text-label-md text-on-surface-variant bg-surface-container px-sm py-xs rounded">Today</span>
                </div>
                
                {/* Simplified Peak Hour Chart Visualization */}
                <div className="flex-1 flex items-end justify-between gap-sm min-h-[200px] mb-lg relative">
                  {/* Chart Y-Axis Markers */}
                  <div className="absolute left-0 top-0 bottom-0 w-full flex flex-col justify-between border-b border-outline-variant opacity-20 pointer-events-none">
                    <div className="border-t border-outline-variant w-full"></div>
                    <div className="border-t border-outline-variant w-full"></div>
                    <div className="border-t border-outline-variant w-full"></div>
                  </div>
                  <div className="bg-primary/20 w-full rounded-t hover:bg-primary transition-colors cursor-help relative group" style={{ height: `${(graphCounts[0] / maxCount) * 95}%` }} title="8 AM - 10 AM">
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-sm py-xs rounded whitespace-nowrap">{graphCounts[0]} Orders</div>
                  </div>
                  <div className="bg-primary/30 w-full rounded-t hover:bg-primary transition-colors cursor-help relative group" style={{ height: `${(graphCounts[1] / maxCount) * 95}%` }} title="10 AM - 12 PM">
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-sm py-xs rounded whitespace-nowrap">{graphCounts[1]} Orders</div>
                  </div>
                  <div className="bg-primary w-full rounded-t hover:bg-primary-container transition-colors cursor-help relative group" style={{ height: `${(graphCounts[2] / maxCount) * 95}%` }} title="12 PM - 2 PM">
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-sm py-xs rounded whitespace-nowrap">{graphCounts[2]} Orders</div>
                  </div>
                  <div className="bg-primary/40 w-full rounded-t hover:bg-primary transition-colors cursor-help relative group" style={{ height: `${(graphCounts[3] / maxCount) * 95}%` }} title="2 PM - 4 PM">
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-sm py-xs rounded whitespace-nowrap">{graphCounts[3]} Orders</div>
                  </div>
                  <div className="bg-primary/60 w-full rounded-t hover:bg-primary transition-colors cursor-help relative group" style={{ height: `${(graphCounts[4] / maxCount) * 95}%` }} title="4 PM - 6 PM">
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-sm py-xs rounded whitespace-nowrap">{graphCounts[4]} Orders</div>
                  </div>
                  <div className="bg-primary/25 w-full rounded-t hover:bg-primary transition-colors cursor-help relative group" style={{ height: `${(graphCounts[5] / maxCount) * 95}%` }} title="6 PM - 8 PM">
                    <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] px-sm py-xs rounded whitespace-nowrap">{graphCounts[5]} Orders</div>
                  </div>
                </div>
                
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold uppercase mb-lg px-xs">
                  <span>08:00</span>
                  <span>12:00</span>
                  <span>16:00</span>
                  <span>20:00</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-auto p-lg text-center border-t border-outline-variant/30">
          <p className="text-label-md text-on-surface-variant">© 2024 Stratizen University Dining. System status: <span className="text-secondary font-bold">Operational</span></p>
        </footer>
      </main>
    </div>
  );
}

export default ChefDashboard;
