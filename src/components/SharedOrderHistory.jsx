import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchCompletedOrders } from "../services/analyticsService";
import { generateDailyReport } from "../utils/generateDailyReport";
import ChefNotificationCentre from "./ChefNotificationCentre";
import ChefLogoutButton from "./ChefLogoutButton";
import "../styles/OrderHistory.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getAvatarColorClass = (id) => {
  const classes = [
    { bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed" },
    { bg: "bg-primary-fixed", text: "text-on-primary-fixed" },
    { bg: "bg-surface-variant", text: "text-on-surface-variant" },
    { bg: "bg-secondary-fixed", text: "text-on-secondary-fixed" }
  ];
  const numId = typeof id === "number" ? id : parseInt(id.toString().replace(/\D/g, ""), 10) || 0;
  return classes[numId % classes.length];
};

const getInitials = (name) => {
  if (!name) return "SO";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

const formatCompletionTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const txDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  if (txDay.getTime() === today.getTime()) {
    return `${timeStr} (Today)`;
  } else if (txDay.getTime() === yesterday.getTime()) {
    return `${timeStr} (Yesterday)`;
  } else {
    const day = date.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${timeStr} (${day} ${months[date.getMonth()]})`;
  }
};

function SharedOrderHistory({ role = "chef", isEmbedded = false, onLogout }) {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMetric, setActiveMetric] = useState("volume"); // "volume" | "revenue" | "speed"
  const [exportState, setExportState] = useState("idle"); // "idle" | "fetching" | "generating" | "success" | "error"
  const [exportMessage, setExportMessage] = useState("");
  const toastTimeoutRef = useRef(null);

  // KPI States
  const [totalTodayCount, setTotalTodayCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [avgPrepTime, setAvgPrepTime] = useState(0);

  // Hourly Analytics Data
  const [analyticsData, setAnalyticsData] = useState([]);

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      const historyData = await fetchCompletedOrders(role);

      const mapped = (historyData || []).map(o => ({
        id: o.id,
        name: o.student_name || "Student",
        items: (o.order_items || []).map(oi => `${oi.menu?.name || 'Meal'} (x${oi.quantity})`).join(", "),
        itemsList: (o.order_items || []).map(oi => ({
          name: oi.menu?.name || "Meal",
          quantity: oi.quantity
        })),
        placedAt: o.created_at,
        prepStartedAt: o.prep_started_at,
        readyAt: o.ready_at,
        collectedAt: o.collected_at,
        total: parseFloat(o.total)
      }));

      setOrders(mapped);

      // Calculate today's stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = mapped.filter(o => new Date(o.collectedAt || o.placedAt) >= todayStart);

      setTotalTodayCount(todayOrders.length);
      
      const revenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
      setTotalRevenue(revenue);

      // Average prep time in minutes (readyAt - prepStartedAt)
      let totalPrepMinutes = 0;
      let prepCount = 0;
      todayOrders.forEach(o => {
        if (o.prepStartedAt && o.readyAt) {
          const diffMs = new Date(o.readyAt) - new Date(o.prepStartedAt);
          totalPrepMinutes += diffMs / 60000;
          prepCount++;
        }
      });
      setAvgPrepTime(prepCount > 0 ? Math.round(totalPrepMinutes / prepCount) : 0);

      // Calculate historical daily data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });

      const dailyStats = last7Days.map(date => {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        const dayOrders = mapped.filter(o => {
          const d = new Date(o.collectedAt || o.placedAt);
          return d >= date && d < nextDay;
        });

        const vol = dayOrders.length;
        const rev = dayOrders.reduce((sum, o) => sum + o.total, 0);
        
        let dayPrepSum = 0;
        let dayPrepCount = 0;
        dayOrders.forEach(o => {
          if (o.prepStartedAt && o.readyAt) {
            dayPrepSum += (new Date(o.readyAt) - new Date(o.prepStartedAt)) / 60000;
            dayPrepCount++;
          }
        });
        const speed = dayPrepCount > 0 ? Math.round(dayPrepSum / dayPrepCount) : 0;
        
        const label = date.toLocaleDateString("en-US", { weekday: 'short' });

        return { label, volume: vol, revenue: rev, speed };
      });

      setAnalyticsData(dailyStats);

    } catch (err) {
      console.error("Failed to load history data:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoryData();

    // Subscribe to changes on the orders table in real-time
    const orderSubscription = supabase
      .channel(`${role}_history_orders_changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          console.log("Real-time update in order history");
          loadHistoryData();
        }
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, [role]);

  // Filter orders by search term
  const filteredOrders = orders.filter((order) => {
    const query = searchTerm.toLowerCase();
    const idMatch = order.id.toString().includes(query);
    const orderNoMatch = `STR-${order.id.substring(0, 8).toUpperCase()}`.toLowerCase().includes(query);
    const nameMatch = order.name.toLowerCase().includes(query);
    const itemsMatch = order.items.toLowerCase().includes(query);
    return idMatch || orderNoMatch || nameMatch || itemsMatch;
  });

  // Pagination logic
  const ordersPerPage = 10;
  const totalPages = Math.max(Math.ceil(filteredOrders.length / ordersPerPage), 1);
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  // PDF Report Exporter
  const handleExportPDF = async () => {
    if (exportState === "fetching" || exportState === "generating") return;

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);

    setExportState("fetching");
    setExportMessage("Fetching today's data...");

    const result = await generateDailyReport((phase) => {
      if (phase === "fetching") {
        setExportState("fetching");
        setExportMessage("Fetching today's data...");
      } else if (phase === "generating") {
        setExportState("generating");
        setExportMessage("Generating PDF report...");
      }
    }, role);

    if (result.success) {
      setExportState("success");
      setExportMessage(`Report exported successfully — ${result.filename}`);
    } else {
      setExportState("error");
      setExportMessage(`Export failed: ${result.error}. Please try again.`);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setExportState("idle");
      setExportMessage("");
    }, 5000);
  };

  // Calculate bar heights for peak ordering times chart
  const getBarHeightAndLabel = (d) => {
    if (activeMetric === "volume") {
      const maxVal = Math.max(...analyticsData.map(x => x.volume), 1);
      return {
        height: `${(d.volume / maxVal) * 85 + 5}%`,
        label: `${d.volume} Orders`
      };
    } else if (activeMetric === "revenue") {
      const maxVal = Math.max(...analyticsData.map(x => x.revenue), 1);
      return {
        height: `${(d.revenue / maxVal) * 85 + 5}%`,
        label: `KES ${d.revenue.toLocaleString()}`
      };
    } else {
      const maxVal = Math.max(...analyticsData.map(x => x.speed), 1);
      return {
        height: `${(d.speed / maxVal) * 85 + 5}%`,
        label: `${d.speed} Mins`
      };
    }
  };

  const renderContent = () => {
    return (
      <div className="order-history-container p-lg max-w-7xl mx-auto w-full flex-grow flex flex-col space-y-xl" style={{ minHeight: "auto", background: "transparent" }}>
        {/* Page Title & CTA */}
        <div className="flex justify-between items-end mb-xl shrink-0">
          <div>
            <h3 className="text-headline-lg text-on-background font-bold">Completed Orders</h3>
            <p className="text-body-lg text-on-surface-variant">Manage and review student transactions</p>
          </div>
          <button 
            className={`flex items-center gap-sm px-lg py-2.5 rounded-lg font-label-lg transition-all border-none cursor-pointer ${
              exportState === "fetching" || exportState === "generating"
                ? "bg-primary/60 text-on-primary cursor-wait"
                : "bg-primary text-on-primary hover:shadow-lg active:opacity-80"
            }`}
            type="button"
            onClick={handleExportPDF}
            disabled={exportState === "fetching" || exportState === "generating"}
          >
            {exportState === "fetching" || exportState === "generating" ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: "18px" }}>sync</span>
                <span>{exportState === "fetching" ? "Fetching Data..." : "Generating PDF..."}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">picture_as_pdf</span>
                <span>Export Today's Report</span>
              </>
            )}
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl shrink-0">
          <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/30 flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">shopping_cart_checkout</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider">Total Today</p>
              <p className="text-title-lg font-bold">{totalTodayCount} Orders</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/30 flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-secondary-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">payments</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider">Revenue Today</p>
              <p className="text-title-lg font-bold text-secondary">KES {formatKES(totalRevenue)}</p>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/30 flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-tertiary-fixed/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary">timer</span>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wider">Avg. Prep Time</p>
              <p className="text-title-lg font-bold">{avgPrepTime} mins</p>
            </div>
          </div>
        </div>

        {/* Orders Table Container */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden flex-grow flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium">Order ID</th>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium">Student Name</th>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium">Items Ordered</th>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium">Completion Time</th>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium">Total KES</th>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium">Status</th>
                  <th className="px-lg py-md text-label-lg text-on-surface-variant font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-xl text-on-surface-variant">
                      <span className="animate-spin material-symbols-outlined text-3xl text-primary inline-block">sync</span>
                      <p className="mt-2 text-xs">Loading completed orders...</p>
                    </td>
                  </tr>
                ) : currentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-xl text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl text-outline mb-xs block">history</span>
                      <p className="font-bold text-on-surface">No completed orders found.</p>
                    </td>
                  </tr>
                ) : (
                  currentOrders.map((order) => {
                    const avatarColors = getAvatarColorClass(order.id);
                    return (
                      <tr key={order.id} className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group">
                        <td className="px-lg py-md font-bold text-primary">
                          #STR-{order.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-sm">
                            <div className={`w-8 h-8 rounded-full ${avatarColors.bg} flex items-center justify-center text-[10px] font-bold ${avatarColors.text}`}>
                              {getInitials(order.name)}
                            </div>
                            <span className="text-on-surface font-medium">{order.name}</span>
                          </div>
                        </td>
                        <td className="px-lg py-md text-on-surface-variant">{order.items}</td>
                        <td className="px-lg py-md text-on-surface-variant">{formatCompletionTime(order.collectedAt)}</td>
                        <td className="px-lg py-md font-bold text-on-surface">{formatKES(order.total)}</td>
                        <td className="px-lg py-md">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-container text-on-secondary-container">Completed</span>
                        </td>
                        <td className="px-lg py-md text-right">
                          <button 
                            className="p-1 rounded hover:bg-surface-container-high transition-colors text-on-surface-variant group-hover:text-primary border-none bg-transparent cursor-pointer"
                            type="button"
                            onClick={() => alert(`Order Summary:\n\nID: STR-${order.id.toUpperCase()}\nStudent: ${order.name}\nItems: ${order.items}\nPlaced: ${new Date(order.placedAt).toLocaleString()}\nCollected: ${order.collectedAt ? new Date(order.collectedAt).toLocaleString() : ""}\nTotal: KES ${formatKES(order.total)}`)}
                          >
                            <span className="material-symbols-outlined">more_vert</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-lg py-md bg-surface-container-low flex justify-between items-center border-t border-outline-variant shrink-0">
            <p className="text-xs text-on-surface-variant">
              Showing {filteredOrders.length > 0 ? indexOfFirstOrder + 1 : 0} to {Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} orders
            </p>
            <div className="flex items-center gap-sm">
              <button 
                className={`w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant bg-transparent ${currentPage === 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-container-high transition-colors cursor-pointer"}`}
                type="button"
                onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded bg-primary text-on-primary font-bold text-xs border-none cursor-default" type="button">{currentPage}</button>
              <button 
                className={`w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant bg-transparent ${currentPage >= totalPages ? "opacity-30 cursor-not-allowed" : "hover:bg-surface-container-high transition-colors cursor-pointer"}`}
                type="button"
                onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Performance Graph */}
        {analyticsData.length > 0 && (
          <div className="mt-xl bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/30 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-lg">
              <div>
                <h4 className="text-label-lg font-bold text-primary flex items-center gap-xs">
                  <span className="material-symbols-outlined">bar_chart</span>
                  Historical Ordering Trends
                </h4>
                <p className="text-xs text-on-surface-variant mt-xs">Daily distribution of completed order metrics (Last 7 Days)</p>
              </div>

              {/* Metric Selector Tabs */}
              <div className="flex bg-surface-container-high rounded-lg p-1 text-xs font-medium border border-outline-variant/10">
                <button 
                  className={`px-md py-1.5 rounded-md transition-all border-none cursor-pointer ${activeMetric === "volume" ? "bg-surface-container-lowest shadow-sm text-primary font-bold" : "text-on-surface-variant hover:text-primary bg-transparent"}`}
                  type="button"
                  onClick={() => setActiveMetric("volume")}
                >
                  Volume (Orders)
                </button>
                <button 
                  className={`px-md py-1.5 rounded-md transition-all border-none cursor-pointer ${activeMetric === "revenue" ? "bg-surface-container-lowest shadow-sm text-primary font-bold" : "text-on-surface-variant hover:text-primary bg-transparent"}`}
                  type="button"
                  onClick={() => setActiveMetric("revenue")}
                >
                  Revenue (KES)
                </button>
                <button 
                  className={`px-md py-1.5 rounded-md transition-all border-none cursor-pointer ${activeMetric === "speed" ? "bg-surface-container-lowest shadow-sm text-primary font-bold" : "text-on-surface-variant hover:text-primary bg-transparent"}`}
                  type="button"
                  onClick={() => setActiveMetric("speed")}
                >
                  Prep Speed (Mins)
                </button>
              </div>
            </div>

            {/* Bar Chart Canvas */}
            <div className="h-64 flex items-end gap-2 px-4 border-b border-outline-variant/30 relative">
              {/* Y-Axis Gridlines */}
              <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none opacity-10">
                <div className="border-t border-outline w-full"></div>
                <div className="border-t border-outline w-full"></div>
                <div className="border-t border-outline w-full"></div>
                <div className="border-t border-outline w-full"></div>
              </div>

              {analyticsData.map((d, idx) => {
                const { height, label } = getBarHeightAndLabel(d);
                
                const getBarColorClass = (vol) => {
                  if (vol === 0) return "opacity-0";
                  if (vol === 1) return "bg-outline-variant hover:bg-outline";
                  if (vol === 2) return "bg-primary/20 hover:bg-primary/40";
                  if (vol >= 3 && vol <= 4) return "bg-primary/40 hover:bg-primary/60";
                  if (vol >= 5 && vol <= 6) return "bg-primary/60 hover:bg-primary/80";
                  if (vol >= 7 && vol <= 9) return "bg-primary/80 hover:bg-primary";
                  return "bg-primary hover:opacity-80";
                };

                return (
                  <div 
                    key={idx}
                    className={`${getBarColorClass(d.volume)} w-full rounded-t-sm transition-all duration-500 ease-out relative group cursor-help`}
                    style={{ height }}
                    title={`${d.label}: ${label}`}
                  >
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-bold px-2">
              {analyticsData.map((d, idx) => (
                <span key={idx} className="flex-1 text-center">{d.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {(exportState === "success" || exportState === "error") && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-sm px-lg py-md rounded-xl shadow-xl border transition-all animate-slideUp ${
              exportState === "success"
                ? "bg-secondary-container text-on-secondary-container border-secondary/30"
                : "bg-error-container text-on-error-container border-error/30"
            }`}
            style={{ maxWidth: "420px", animation: "slideUp 0.3s ease-out" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              {exportState === "success" ? "check_circle" : "error"}
            </span>
            <p className="text-body-md font-medium flex-1">{exportMessage}</p>
            <button
              className="border-none bg-transparent cursor-pointer text-on-surface-variant hover:text-on-surface p-1 rounded"
              type="button"
              onClick={() => { setExportState("idle"); setExportMessage(""); }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  if (isEmbedded) {
    return renderContent();
  }

  return (
    <div className="order-history-container text-on-background min-h-screen flex">
      {/* Side Navigation */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low flex flex-col py-lg border-r border-outline-variant z-50">
        <div className="px-lg mb-xl flex items-center gap-sm">
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
            <div className="w-full h-full bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container">restaurant</span>
            </div>
          </div>
          <div>
            <h1 className="text-[20px] text-primary font-bold leading-tight">Stratizen Dining</h1>
            <p className="text-xs text-on-surface-variant">Chef Management Portal</p>
          </div>
        </div>

        <nav className="flex-grow px-md space-y-1">
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer font-label-lg" onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>Kitchen Dashboard</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer font-label-lg" onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Manager</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer font-label-lg" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Order Queue</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer font-label-lg" onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
            <span>Kitchen Monitor</span>
          </div>
          <div className="flex items-center gap-md text-on-surface-variant px-md py-sm hover:bg-surface-container-high rounded-lg transition-colors cursor-pointer font-label-lg" onClick={() => navigate("/chef/ready")}>
            <span className="material-symbols-outlined">storefront</span>
            <span>Ready to Collect</span>
          </div>
          <div className="flex items-center gap-md bg-secondary-container text-on-secondary-container rounded-lg px-md py-sm cursor-pointer font-bold font-label-lg shadow-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
            <span>Order History</span>
          </div>
        </nav>

        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-xs">
          <ChefLogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen flex-grow flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center px-lg sticky top-0 z-40 bg-surface/80 backdrop-blur-md shadow-sm h-16 w-full border-b border-outline-variant/30">
          <div className="flex items-center gap-lg flex-grow justify-center">
            <div className="relative w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input 
                className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-full border-none focus:ring-2 focus:ring-primary text-body-md outline-none" 
                placeholder="Search Order ID or Student..." 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-md flex-grow justify-end shrink-0">
            <ChefNotificationCentre />
            <div className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-surface-variant overflow-hidden cursor-pointer" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuD7kgZkdIMTtuz95RIB5jRQiRTAQrze9xLGH0TJU5KOuWlevLAQNWtJzCD1hEINggIw1x5QZ-XWFGp7kw7rZgC0kK84i9UMBy8vhBAkW68JsCt7Od7sEQTBrLxOKaZ-TNfpnxI8oMXp0mxLMSBPQTKLa4OxkH0ozOMiiEqUReL0JaDBKtYDAAwtUgtRPzAS3fdWlpM-BAs0c56ea71ppvdVF_-8a06fzpvPPCPYqu5UWO5WbJNykG5v7SwPpJeTLJGECE898e0VcUg')" }}></div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

export default SharedOrderHistory;
