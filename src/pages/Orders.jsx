import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTray } from "../context/TrayContext";
import { useToast } from "../context/ToastContext";
import AuthLayout from "../components/AuthLayout";
import QuantityCounter from "../components/QuantityCounter";
import "../styles/Orders.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function Orders() {
  const {
    trayItems,
    itemCount,
    subtotal,
    tax,
    total,
    updateQuantity,
    removeFromTray,
    clearTray,
    addToTray,
  } = useTray();

  const { addToast } = useToast();

  const navigate = useNavigate();

  // Mock recent orders that are interactive
  const recentOrders = [
    {
      id: "iced-caramel-latte",
      name: "Iced Caramel Latte",
      price: 450.00,
      time: "Yesterday, 9:15 AM",
      icon: "coffee",
      image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80",
      category: "Drinks",
      description: "Rich espresso combined with milk and sweet caramel syrup over ice.",
    },
    {
      id: "veggie-wrap",
      name: "Veggie Wrap",
      price: 600.00,
      time: "Oct 24, 12:30 PM",
      icon: "tapas",
      image: "https://images.unsplash.com/photo-1626700051175-6518c4793f4f?w=400&q=80",
      category: "Lunch",
      description: "Tortilla wrap filled with mixed greens, red pepper, cucumber, and hummus.",
    },
  ];

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
    alert(`Proceeding to payment of KES ${formatKES(total)} with your Campus Wallet.\nOrder successfully submitted!`);
    clearTray();
    navigate("/menu");
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
          </div>
        </section>

        {/* Sidebar / Secondary Actions */}
        <aside className="orders-sidebar">
          {/* Campus Wallet glance */}
          <div className="wallet-glance-card">
            <div className="wallet-content">
              <div className="wallet-header">
                <h3 className="wallet-title">Campus Wallet</h3>
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
              <div className="wallet-balance">KES 4,250.00</div>
              <p className="wallet-balance-label">Available Balance</p>
              <button
                className="wallet-topup-btn"
                onClick={() => alert("Wallet recharge portal coming soon!")}
              >
                Top Up Balance
              </button>
            </div>
            <div className="wallet-pattern"></div>
          </div>

          {/* Announcements Card */}
          <div className="announcements-card">
            <h3 className="announcements-title">
              <span className="material-symbols-outlined">campaign</span> Announcements
            </h3>
            <ul className="announcements-list">
              <li className="announcement-item">
                <div className="announcement-dot red"></div>
                <div>
                  <h4 className="announcement-header">Lunch Special at Counter B</h4>
                  <p className="announcement-text">
                    Get 10% off all hot bowls between 12 PM and 2 PM today.
                  </p>
                </div>
              </li>
              <li className="announcement-item">
                <div className="announcement-dot blue"></div>
                <div>
                  <h4 className="announcement-header">New Coffee Station Open</h4>
                  <p className="announcement-text">
                    The North Wing now has a self-serve espresso bar.
                  </p>
                </div>
              </li>
            </ul>
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
        <a href="#" onClick={(e) => { e.preventDefault(); alert("Wallet Balance Glance: KES 4,250.00"); }} className="mobile-nav-item">
          <span className="material-symbols-outlined">account_balance_wallet</span>
          <span className="mobile-nav-label">Wallet</span>
        </a>
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
