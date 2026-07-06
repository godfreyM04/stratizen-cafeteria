import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import AuthLayout from "../components/AuthLayout";
import "../styles/OrderTracking.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

const getStepIndex = (status) => {
  switch (status) {
    case "pending": return 2; // Map pending immediately to "Food Being Prepared" (Step 3)
    case "preparing": return 2;
    case "ready": return 3;
    case "collected": return 4;
    default: return 0;
  }
};

function OrderTracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadActiveOrder = async () => {
      try {
        // Fetch the most recent active order from Supabase
        const { data: active, error: fetchError } = await supabase
          .from("orders")
          .select("*, order_items(*, menu(*))")
          .eq("user_id", user.id)
          .in("status", ["pending", "preparing", "ready"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (active) {
          // Map DB items to UI format
          const mappedItems = (active.order_items || []).map(oi => ({
            id: oi.id,
            name: oi.menu?.name || "Meal",
            price: parseFloat(oi.unit_price),
            quantity: oi.quantity,
            category: oi.menu?.category || "Main"
          }));

          // Calculate estimated collection time (15 mins from creation)
          const placedDate = new Date(active.created_at);
          const estDate = new Date(placedDate.getTime() + 15 * 60000);
          const estimatedTime = formatTime(estDate);

          const orderObj = {
            id: active.id,
            placedAt: active.created_at,
            placedFormatted: new Date(active.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            }),
            estimatedTime,
            pickupLocation: active.pickup_option === "dine_in" ? "Pickup Counter A" : "Pickup Counter B",
            paymentMethod: active.wallet_deduction > 0 ? "University Wallet" : "Mobile Money",
            items: mappedItems,
            subtotal: parseFloat(active.subtotal),
            tax: parseFloat(active.total) - parseFloat(active.subtotal),
            total: parseFloat(active.total),
            status: active.status,
            prep_started_at: active.prep_started_at,
            ready_at: active.ready_at,
            collected_at: active.collected_at
          };

          setOrder(orderObj);
          localStorage.setItem("stratizen_active_order", JSON.stringify(orderObj));
        } else {
          setOrder(null);
          localStorage.removeItem("stratizen_active_order");
        }
      } catch (err) {
        console.error("Failed to load active order:", err.message);
      } finally {
        setLoading(false);
      }
    };

    loadActiveOrder();

    // Subscribe to changes on the orders table for this user
    const orderSubscription = supabase
      .channel(`active_order_tracking_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log("Order change detected in tracking:", payload);
          // Reload the entire order to ensure all relations (items) are fetched correctly
          loadActiveOrder();
        }
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, [user]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-md">
          <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
          <p className="text-on-surface-variant font-medium">Retrieving active order status...</p>
        </div>
      </AuthLayout>
    );
  }

  if (!order) {
    return (
      <AuthLayout>
        <div className="order-tracking-container" style={{ textAlign: "center", padding: "80px 0" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)", marginBottom: "16px" }}>
            receipt_long
          </span>
          <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "12px" }}>No Active Order Found</h2>
          <p style={{ color: "var(--color-on-surface-variant)", marginBottom: "24px" }}>
            You don't have an order being prepared right now.
          </p>
          <Link to="/menu" className="support-btn" style={{ display: "inline-block", textDecoration: "none" }}>
            Go to Menu
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const currentStepIndex = getStepIndex(order.status);

  return (
    <AuthLayout>
      <div className="order-tracking-container">
        {/* Header Section */}
        <header className="tracking-header">
          <div className="tracking-title-area">
            <Link to="/menu" className="back-to-menu-link">
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Menu
            </Link>
            <h1>Order #STR-{order.id.substring(0, 8).toUpperCase()}</h1>
            <p className="tracking-placed-date">Placed on {order.placedFormatted}</p>
          </div>
          <div className="est-collection-card">
            <div className="est-icon-wrapper">
              <span className="material-symbols-outlined fill">schedule</span>
            </div>
            <div>
              <p className="est-label">Estimated Collection</p>
              <p className="est-time">{order.estimatedTime}</p>
            </div>
          </div>
        </header>

        {/* Main Grid Content */}
        <div className="tracking-grid">
          {/* Left Column: Timeline */}
          <div className="timeline-card">
            <h2 className="timeline-card-title">Live Tracking</h2>
            <div className="timeline-track">
              
              {/* Step 1: Order Received */}
              <div className="timeline-item">
                <div className={`timeline-line ${currentStepIndex > 0 ? "completed" : ""}`}></div>
                <div className={`timeline-node ${currentStepIndex > 0 ? "completed" : currentStepIndex === 0 ? "active-other" : "pending"}`}>
                  <span className="material-symbols-outlined fill">receipt_long</span>
                </div>
                <div className="timeline-content">
                  {currentStepIndex === 0 ? (
                    <div className="active-content-box other-border">
                      <div className="timeline-content-header">
                        <h3 className="timeline-content-title active-other">Order Received</h3>
                        <span className="status-indicator-badge other">In Progress</span>
                      </div>
                      <p className="timeline-desc">Your order has been securely logged in the system.</p>
                    </div>
                  ) : (
                    <>
                      <div className="timeline-content-header">
                        <h3 className={`timeline-content-title ${currentStepIndex > 0 ? "completed" : "pending"}`}>Order Received</h3>
                        <span className="timeline-time-badge">{formatTime(order.placedAt)}</span>
                      </div>
                      <p className="timeline-desc">Your order has been securely logged in the system.</p>
                    </>
                  )}
                </div>
              </div>

              {/* Step 2: Payment Confirmed */}
              <div className="timeline-item">
                <div className={`timeline-line ${currentStepIndex > 1 ? "completed" : ""}`}></div>
                <div className={`timeline-node ${currentStepIndex > 1 ? "completed" : currentStepIndex === 1 ? "active-other" : "pending"}`}>
                  <span className="material-symbols-outlined fill">check_circle</span>
                </div>
                <div className="timeline-content">
                  {currentStepIndex === 1 ? (
                    <div className="active-content-box other-border">
                      <div className="timeline-content-header">
                        <h3 className="timeline-content-title active-other">Payment Confirmed</h3>
                        <span className="status-indicator-badge other">In Progress</span>
                      </div>
                      <p className="timeline-desc">Payment processed via {order.paymentMethod}.</p>
                    </div>
                  ) : (
                    <>
                      <div className="timeline-content-header">
                        <h3 className={`timeline-content-title ${currentStepIndex > 1 ? "completed" : "pending"}`}>Payment Confirmed</h3>
                        {currentStepIndex > 1 && (
                          <span className="timeline-time-badge">{formatTime(order.placedAt)}</span>
                        )}
                      </div>
                      <p className={`timeline-desc ${currentStepIndex < 1 ? "pending" : ""}`}>
                        Payment processed via {order.paymentMethod}.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Step 3: Food Being Prepared */}
              <div className="timeline-item">
                <div className={`timeline-line ${currentStepIndex > 2 ? "completed" : ""}`}></div>
                <div className={`timeline-node ${currentStepIndex > 2 ? "completed" : currentStepIndex === 2 ? "active-preparing" : "pending"}`}>
                  <span className="material-symbols-outlined fill">skillet</span>
                </div>
                <div className="timeline-content">
                  {currentStepIndex === 2 ? (
                    <div className="active-content-box preparing-border">
                      <div className="timeline-content-header">
                        <h3 className="timeline-content-title active-preparing">Food Being Prepared</h3>
                        <span className="status-indicator-badge preparing">In Progress</span>
                      </div>
                      <p className="timeline-desc" style={{ color: "var(--color-on-surface)" }}>
                        The kitchen is currently preparing your meal. It will be ready shortly.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="timeline-content-header">
                        <h3 className={`timeline-content-title ${currentStepIndex > 2 ? "completed" : "pending"}`}>Food Being Prepared</h3>
                        {order.prep_started_at && (
                          <span className="timeline-time-badge">{formatTime(order.prep_started_at)}</span>
                        )}
                      </div>
                      <p className={`timeline-desc ${currentStepIndex < 2 ? "pending" : ""}`}>
                        The kitchen is currently preparing your meal. It will be ready shortly.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Step 4: Ready for Pickup */}
              <div className="timeline-item">
                <div className={`timeline-line ${currentStepIndex > 3 ? "completed" : ""}`}></div>
                <div className={`timeline-node ${currentStepIndex > 3 ? "completed" : currentStepIndex === 3 ? "active-other" : "pending"}`}>
                  <span className="material-symbols-outlined">storefront</span>
                </div>
                <div className="timeline-content">
                  {currentStepIndex === 3 ? (
                    <div className="active-content-box other-border">
                      <div className="timeline-content-header">
                        <h3 className="timeline-content-title active-other">Ready for Pickup</h3>
                        <span className="status-indicator-badge other">Active</span>
                      </div>
                      <p className="timeline-desc" style={{ color: "var(--color-on-surface)" }}>
                        Your meal is ready! Please collect it from <strong>{order.pickupLocation}</strong>.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="timeline-content-header">
                        <h3 className={`timeline-content-title ${currentStepIndex > 3 ? "completed" : "pending"}`}>Ready for Pickup</h3>
                        {order.ready_at && (
                          <span className="timeline-time-badge">{formatTime(order.ready_at)}</span>
                        )}
                      </div>
                      <p className={`timeline-desc ${currentStepIndex < 3 ? "pending" : ""}`}>
                        {currentStepIndex > 3 
                          ? `Collected from ${order.pickupLocation}.` 
                          : "Waiting for preparation to complete."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Step 5: Order Collected */}
              <div className="timeline-item">
                <div className={`timeline-node ${currentStepIndex === 4 ? "completed" : "pending"}`}>
                  <span className="material-symbols-outlined">done_all</span>
                </div>
                <div className="timeline-content">
                  {currentStepIndex === 4 ? (
                    <div className="active-content-box other-border">
                      <div className="timeline-content-header">
                        <h3 className="timeline-content-title active-other">Order Collected</h3>
                        <span className="status-indicator-badge other">Completed</span>
                      </div>
                      <p className="timeline-desc" style={{ color: "var(--color-on-surface)" }}>
                        Thank you for dining with us! Your order has been collected successfully.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="timeline-content-header">
                        <h3 className={`timeline-content-title pending`}>Order Collected</h3>
                      </div>
                      <p className="timeline-desc pending">Waiting for pickup confirmation.</p>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Order Details */}
          <div className="tracking-sidebar">
            {/* Order Summary Card */}
            <div className="summary-card-tracking">
              <h3 className="summary-card-title">Order Summary</h3>
              <ul className="summary-items-list">
                {order.items.map((item) => (
                  <li key={item.id} className="summary-item-row">
                    <div className="summary-item-details">
                      <span className="summary-item-name">{item.quantity}x {item.name}</span>
                      <span className="summary-item-note">{item.category}</span>
                    </div>
                    <span className="summary-item-price">KES {formatKES(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="calculations-area">
                <div className="calc-row">
                  <span>Subtotal</span>
                  <span>KES {formatKES(order.subtotal)}</span>
                </div>
                <div className="calc-row">
                  <span>Tax (8%)</span>
                  <span>KES {formatKES(order.tax)}</span>
                </div>
                <div className="calc-row-total">
                  <span className="calc-total-label">Total</span>
                  <span className="calc-total-val">KES {formatKES(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Support Card */}
            <div className="support-card">
              <h4 className="support-title">
                <span className="material-symbols-outlined">help</span>
                Need Assistance?
              </h4>
              <p className="support-desc">
                If you have any questions about your order, please contact campus cafeteria support.
              </p>
              <button className="support-btn cursor-pointer border-none" onClick={() => alert("Support ticket created! We will contact you shortly.")}>
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

export default OrderTracking;
