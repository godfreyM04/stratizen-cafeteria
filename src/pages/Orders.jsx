import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTray } from "../context/TrayContext";
import { useToast } from "../context/ToastContext";
import { mockMenuItems } from "../data/mockMenu";
import AuthLayout from "../components/AuthLayout";
import QuantityCounter from "../components/QuantityCounter";
import "../styles/Orders.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case "drinks": return "coffee";
    case "breakfast": return "free_breakfast";
    case "lunch": return "restaurant";
    case "dinner": return "dinner_dining";
    case "snacks": return "cookie";
    default: return "restaurant";
  }
};

const formatRecentOrderTime = (isoString) => {
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
    return `Today, ${timeStr}`;
  } else if (txDay.getTime() === yesterday.getTime()) {
    return `Yesterday, ${timeStr}`;
  } else {
    const day = date.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}, ${timeStr}`;
  }
};

function Orders() {
  const {
    trayItems,
    itemCount,
    subtotal,
    tax,
    total,
    addToTray,
  } = useTray();

  const { addToast } = useToast();
  const navigate = useNavigate();

  const [walletBalance] = useState(() => {
    const cached = localStorage.getItem("stratizen_wallet_balance");
    return cached ? parseFloat(cached) : 42.50;
  });

  const [recentOrders] = useState(() => {
    const historyJson = localStorage.getItem("stratizen_order_history");
    if (historyJson) {
      try {
        const history = JSON.parse(historyJson);
        const itemMap = new Map();

        // Populate the items while preserving the most recent order date
        history.forEach((order) => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((orderItem) => {
              // Ensure item still exists in Menu database
              const menuMatch = mockMenuItems.find(m => m.id === orderItem.id);
              if (menuMatch) {
                const existing = itemMap.get(orderItem.id);
                if (!existing || new Date(order.placedAt) > new Date(existing.placedAt)) {
                  itemMap.set(orderItem.id, {
                    ...menuMatch,
                    placedAt: order.placedAt,
                    time: formatRecentOrderTime(order.placedAt),
                    icon: getCategoryIcon(menuMatch.category)
                  });
                }
              }
            });
          }
        });

        // Convert Map to array sorted by placedAt date descending
        return Array.from(itemMap.values()).sort(
          (a, b) => new Date(b.placedAt) - new Date(a.placedAt)
        );
      } catch (e) {
        console.error("Failed to parse order history:", e);
      }
    }
    return [];
  });

  const handleReorder = (item) => {
    addToTray(
      {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        description: item.description,
      },
      1
    );
    addToast(`Added the ${item.name} to the tray`);
  };

  const handleCheckout = () => {
    navigate("/checkout");
  };

  return (
    <AuthLayout>
      <div className="orders-page-grid">
        {/* Left Section: Your Tray & Recents */}
        <section className="orders-left-section">
          <div className="tray-header-row">
            <h2 className="tray-title">Your Tray</h2>
            <span className="tray-count-badge">
              {itemCount} {itemCount === 1 ? "Item" : "Items"}
            </span>
          </div>

          <div className="tray-items-list">
            {trayItems.length > 0 ? (
              trayItems.map((item) => (
                <div key={item.id} className="tray-item-card">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="tray-item-image"
                  />
                  <div className="tray-item-info">
                    <span className="tray-item-category">{item.category}</span>
                    <h3 className="tray-item-name">{item.name}</h3>
                    <p className="tray-item-desc">{item.description}</p>
                  </div>
                  <div className="tray-item-controls-price">
                    <QuantityCounter itemId={item.id} />
                    <span className="tray-item-total-price">
                      KES {formatKES(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-tray-message">
                <span className="material-symbols-outlined" style={{ fontSize: "48px", marginBottom: "12px", color: "var(--color-outline)" }}>
                  shopping_basket
                </span>
                <p style={{ fontSize: "16px", fontWeight: "500", marginBottom: "8px" }}>Your tray is currently empty.</p>
                <p style={{ fontSize: "14px", color: "var(--color-on-surface-variant)" }}>
                  Head over to the <Link to="/menu" style={{ color: "var(--color-primary)", textDecoration: "underline", fontWeight: "600" }}>Menu</Link> to add fresh meals to your tray!
                </p>
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="recents-section">
            <div className="recents-header-row">
              <h2 className="recents-title">Recent Orders</h2>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Full orders history coming soon!");
                }}
                className="recents-view-all"
              >
                View All
              </a>
            </div>
            {recentOrders.length > 0 ? (
              <div className="recents-horizontal-scroll">
                {recentOrders.map((order) => (
                  <div key={order.id} className="recents-card">
                    <div className="recents-icon-box">
                      <span className="material-symbols-outlined">{order.icon}</span>
                    </div>
                    <div className="recents-info">
                      <h4 className="recents-name">{order.name}</h4>
                      <p className="recents-time">{order.time}</p>
                      <p className="recents-price">KES {formatKES(order.price)}</p>
                    </div>
                    <button
                      className="recents-reorder-btn"
                      onClick={() => handleReorder(order)}
                      title="Reorder"
                    >
                      <span className="material-symbols-outlined">replay</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-recents-container">
                <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "var(--color-outline)", marginBottom: "8px" }}>
                  history
                </span>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-on-surface)", marginBottom: "4px" }}>No recent orders yet</p>
                <p style={{ fontSize: "12px", color: "var(--color-on-surface-variant)" }}>Your ordered items will appear here for quick reordering.</p>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar / Secondary Actions */}
        <aside className="orders-sidebar">
          {/* Campus Wallet glance */}
          <div className="wallet-glance-card">
            <div className="wallet-content">
              <div className="wallet-header">
                <h3 className="wallet-glance-title">Campus Wallet</h3>
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div className="wallet-balance">KES {formatKES(walletBalance)}</div>
              <p className="wallet-balance-label">Available Balance</p>
              <button
                className="wallet-topup-btn"
                onClick={() => navigate("/wallet")}
              >
                Top Up Balance
              </button>
            </div>
            <div className="wallet-pattern"></div>
          </div>

          {/* Order Summary */}
          <div className="summary-card">
            <h3 className="summary-title">Order Summary</h3>
            <div className="summary-rows">
              <div className="summary-row">
                <span>Subtotal</span>
                <span className="summary-row-val">KES {formatKES(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Tax (8%)</span>
                <span className="summary-row-val">KES {formatKES(tax)}</span>
              </div>
              <div className="summary-row">
                <span>Service Fee</span>
                <span className="summary-row-val free">FREE</span>
              </div>
            </div>
            <div className="summary-total-area">
              <div className="summary-total-row">
                <span className="summary-total-label">Total</span>
                <span className="summary-total-val">KES {formatKES(total)}</span>
              </div>
            </div>
            <button
              className="summary-pay-btn"
              onClick={handleCheckout}
              disabled={trayItems.length === 0}
            >
              <span>Proceed to Payment</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Navigation Menu */}
      <nav className="mobile-bottom-nav">
        <Link to="/menu" className="mobile-nav-item">
          <span className="material-symbols-outlined">home</span>
          <span className="mobile-nav-label">Home</span>
        </Link>
        <Link to="/menu" className="mobile-nav-item">
          <span className="material-symbols-outlined">menu_book</span>
          <span className="mobile-nav-label">Menu</span>
        </Link>
        <Link to="/orders" className="mobile-nav-item active">
          <div className="mobile-active-wrapper">
            <span className="material-symbols-outlined icon-fill">room_service</span>
          </div>
          <span className="mobile-nav-label">Tray</span>
        </Link>
        <Link to="/wallet" className="mobile-nav-item">
          <span className="material-symbols-outlined">account_balance_wallet</span>
          <span className="mobile-nav-label">Wallet</span>
        </Link>
        <a href="#" onClick={(e) => { e.preventDefault(); alert("Profile info"); }} className="mobile-nav-item">
          <span className="material-symbols-outlined">person</span>
          <span className="mobile-nav-label">Profile</span>
        </a>
      </nav>
      {/* Mobile spacer */}
      <div className="mobile-nav-spacer"></div>
    </AuthLayout>
  );
}

export default Orders;
