import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTray } from "../context/TrayContext";
import { useToast } from "../context/ToastContext";
import "../styles/Checkout.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Canvas-based particles celebration animation
const CelebrationCanvas = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    
    class Confetti {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height - 20;
        this.size = Math.random() * 8 + 6;
        this.speedX = Math.random() * 4 - 2;
        this.speedY = Math.random() * 4 + 4;
        // Theme colors: deep navy, green, teal, orange, gold, pink (dynamic for dark mode)
        const isDark = document.documentElement.classList.contains("dark");
        const colors = isDark 
          ? ["#4f8eff", "#3ad06c", "#61c3f2", "#ff8c00", "#ffd54f", "#e91e63"]
          : ["#003366", "#1b6d24", "#00668e", "#ff8c00", "#ffd54f", "#e91e63"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 4 - 2;
      }
      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
        if (this.y > canvas.height) {
          this.y = -20;
          this.x = Math.random() * canvas.width;
        }
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
      }
    }
    
    class Sparkle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 3 + 2;
        this.alpha = Math.random();
        this.speed = Math.random() * 0.05 + 0.01;
        this.growing = Math.random() > 0.5;
      }
      update() {
        if (this.growing) {
          this.alpha += this.speed;
          if (this.alpha >= 1) {
            this.alpha = 1;
            this.growing = false;
          }
        } else {
          this.alpha -= this.speed;
          if (this.alpha <= 0.1) {
            this.alpha = 0.1;
            this.growing = true;
          }
        }
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = "#ffb77d"; // Gold star color
        ctx.beginPath();
        
        const cx = this.x;
        const cy = this.y;
        const spikes = 4;
        const outerRadius = this.size * 2;
        const innerRadius = this.size;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          const rx = cx + Math.cos(rot) * outerRadius;
          const ry = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(rx, ry);
          rot += step;
          
          const ix = cx + Math.cos(rot) * innerRadius;
          const iy = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(ix, iy);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    
    const confettis = Array.from({ length: 120 }, () => new Confetti());
    const sparkles = Array.from({ length: 50 }, () => new Sparkle());
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      sparkles.forEach((s) => {
        s.update();
        s.draw();
      });
      
      confettis.forEach((c) => {
        c.update();
        c.draw();
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 2000,
      }}
    />
  );
};

function Checkout() {
  const navigate = useNavigate();
  const { trayItems, subtotal, tax, total, clearTray } = useTray();
  const { addToast } = useToast();

  const [pickupLocation, setPickupLocation] = useState("counter_a");
  const [paymentMethod, setPaymentMethod] = useState("wallet");

  const [walletBalance, setWalletBalance] = useState(() => {
    const cached = localStorage.getItem("stratizen_wallet_balance");
    return cached ? parseFloat(cached) : 4550.00;
  });

  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  const handlePlaceOrder = () => {
    if (trayItems.length === 0) {
      alert("Your tray is empty! Add items from the menu first.");
      navigate("/menu");
      return;
    }

    const orderId = "STR-" + Math.floor(1000 + Math.random() * 9000);
    const placedDate = new Date();
    const estMinutes = pickupLocation === "counter_a" ? 15 : 10;
    
    // Calculate estimated collection time
    const estDate = new Date(placedDate.getTime() + estMinutes * 60000);
    let estHours = estDate.getHours();
    const estMins = estDate.getMinutes().toString().padStart(2, "0");
    const estAmpm = estHours >= 12 ? "PM" : "AM";
    estHours = estHours % 12;
    estHours = estHours ? estHours : 12;
    const estimatedTime = `${estHours}:${estMins} ${estAmpm}`;

    // Format placed date & time (e.g. Oct 24, 2024 at 11:42 AM)
    const options = { month: "short", day: "numeric", year: "numeric" };
    const dateStr = placedDate.toLocaleDateString("en-US", options);
    let placedHours = placedDate.getHours();
    const placedMins = placedDate.getMinutes().toString().padStart(2, "0");
    const placedAmpm = placedHours >= 12 ? "PM" : "AM";
    placedHours = placedHours % 12;
    placedHours = placedHours ? placedHours : 12;
    const placedFormatted = `${dateStr} at ${placedHours}:${placedMins} ${placedAmpm}`;

    const activeOrder = {
      id: orderId,
      placedAt: placedDate.toISOString(),
      placedFormatted: placedFormatted,
      estimatedTime: estimatedTime,
      pickupLocation: pickupLocation === "counter_a" ? "Pickup Counter A" : "Pickup Counter B",
      paymentMethod: paymentMethod === "wallet" ? "University Wallet" : "Mobile Money",
      items: [...trayItems],
      subtotal: subtotal,
      tax: tax,
      total: total,
      status: "received" // Initial status
    };

    if (paymentMethod === "wallet") {
      if (walletBalance < total) {
        setShowInsufficientBalanceModal(true);
        return;
      }

      // Deduct balance
      const nextBalance = walletBalance - total;
      setWalletBalance(nextBalance);
      localStorage.setItem("stratizen_wallet_balance", nextBalance.toFixed(2));

      // Append transaction
      const transactionsJson = localStorage.getItem("stratizen_wallet_transactions");
      let transactions = [];
      if (transactionsJson) {
        try {
          transactions = JSON.parse(transactionsJson);
        } catch (e) {
          console.error(e);
        }
      }
      
      const newTx = {
        id: "tx-order-" + Date.now(),
        type: "purchase",
        title: "Main Dining Hall",
        desc: `${activeOrder.pickupLocation} • ` + trayItems.map(i => `${i.quantity}x ${i.name}`).join(", ").substring(0, 30),
        timestamp: placedDate.toISOString(),
        amount: total
      };

      transactions.unshift(newTx);
      localStorage.setItem("stratizen_wallet_transactions", JSON.stringify(transactions));
      
      addToast(`Order placed successfully! KES ${formatKES(total)} paid via University Wallet.`);
    } else if (paymentMethod === "mobile") {
      alert("Redirecting to Mobile Money payment gateway...");
      addToast("Order placed successfully via Mobile Money!");
    }

    // Save order to history for Recent Orders
    const historyJson = localStorage.getItem("stratizen_order_history");
    let history = [];
    if (historyJson) {
      try {
        history = JSON.parse(historyJson);
      } catch (e) {
        console.error(e);
      }
    }
    history.unshift({
      id: orderId,
      placedAt: placedDate.toISOString(),
      items: trayItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        category: item.category,
        description: item.description,
        quantity: item.quantity
      }))
    });
    localStorage.setItem("stratizen_order_history", JSON.stringify(history));

    // Save active order to localStorage
    localStorage.setItem("stratizen_active_order", JSON.stringify(activeOrder));

    clearTray();
    setShowSuccessOverlay(true);
  };

  return (
    <div className="checkout-page-container">
      {/* Back Link & Header */}
      <div className="checkout-header-nav">
        <Link to="/menu" className="checkout-back-link">
          <span className="material-symbols-outlined" style={{ fontSize: "20px", marginRight: "8px" }}>arrow_back</span>
          Back to Menu
        </Link>
        <h1 className="checkout-title">Checkout</h1>
      </div>

      {/* Main Grid */}
      <div className="checkout-grid">
        {/* Left Column: Pickup & Payment options */}
        <div className="checkout-left-col">
          
          {/* Pickup Options */}
          <section className="checkout-card-section">
            <h2 className="checkout-section-title">
              <span className="material-symbols-outlined checkout-section-title-icon">storefront</span>
              Pickup Options
            </h2>
            
            <div className="pickup-options-grid">
              
              {/* Counter A */}
              <label 
                className={`selection-card ${pickupLocation === "counter_a" ? "selection-card-active" : ""}`}
              >
                <input 
                  type="radio" 
                  name="pickup_location" 
                  value="counter_a" 
                  checked={pickupLocation === "counter_a"}
                  onChange={() => setPickupLocation("counter_a")}
                  className="sr-only"
                />
                <div className="selection-card-content">
                  <span className="selection-card-title">Pickup Counter A</span>
                  <span className="selection-card-desc">Ground Floor</span>
                  <span className="time-badge">
                    <span className="material-symbols-outlined" style={{ fontSize: "14px", marginRight: "4px" }}>timer</span>
                    Est. 10-15 mins
                  </span>
                </div>
                <div className="radio-indicator">
                  {pickupLocation === "counter_a" && <div className="radio-dot"></div>}
                </div>
              </label>

              {/* Counter B */}
              <label 
                className={`selection-card ${pickupLocation === "counter_b" ? "selection-card-active" : ""}`}
              >
                <input 
                  type="radio" 
                  name="pickup_location" 
                  value="counter_b" 
                  checked={pickupLocation === "counter_b"}
                  onChange={() => setPickupLocation("counter_b")}
                  className="sr-only"
                />
                <div className="selection-card-content">
                  <span className="selection-card-title">Pickup Counter B</span>
                  <span className="selection-card-desc">Second Floor</span>
                  <span className="time-badge time-badge-low">
                    <span className="material-symbols-outlined" style={{ fontSize: "14px", marginRight: "4px" }}>timer</span>
                    Est. 5-10 mins
                  </span>
                </div>
                <div className="radio-indicator">
                  {pickupLocation === "counter_b" && <div className="radio-dot"></div>}
                </div>
              </label>

            </div>
          </section>

          {/* Payment Methods */}
          <section className="checkout-card-section">
            <h2 className="checkout-section-title">
              <span className="material-symbols-outlined checkout-section-title-icon">payments</span>
              Payment Methods
            </h2>
            
            <div className="payment-methods-stack">
              
              {/* University Wallet */}
              <label 
                className={`payment-selection-card ${paymentMethod === "wallet" ? "payment-selection-card-active" : ""}`}
              >
                <input 
                  type="radio" 
                  name="payment_method" 
                  value="wallet" 
                  checked={paymentMethod === "wallet"}
                  onChange={() => setPaymentMethod("wallet")}
                  className="sr-only"
                />
                <div className="payment-left-block" style={{ display: "flex", alignItems: "center" }}>
                  <div className="payment-icon-wrapper pay-icon-bg-wallet">
                    <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>account_balance_wallet</span>
                  </div>
                  <div className="payment-card-details">
                    <span className="payment-card-title">University Wallet</span>
                    <span className="payment-card-desc">Balance: KES {formatKES(walletBalance)}</span>
                    <span className="promo-points-label">+5 Strat points</span>
                  </div>
                </div>
                <div className="radio-indicator">
                  {paymentMethod === "wallet" && <div className="radio-dot"></div>}
                </div>
              </label>

              {/* Mobile Money */}
              <label 
                className={`payment-selection-card ${paymentMethod === "mobile" ? "payment-selection-card-active" : ""}`}
              >
                <input 
                  type="radio" 
                  name="payment_method" 
                  value="mobile" 
                  checked={paymentMethod === "mobile"}
                  onChange={() => setPaymentMethod("mobile")}
                  className="sr-only"
                />
                <div className="payment-left-block" style={{ display: "flex", alignItems: "center" }}>
                  <div className="payment-icon-wrapper pay-icon-bg-other">
                    <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>phone_iphone</span>
                  </div>
                  <div className="payment-card-details">
                    <span className="payment-card-title">Mobile Money</span>
                    <span className="payment-card-desc">Pay via M-pesa</span>
                  </div>
                </div>
                <div className="radio-indicator">
                  {paymentMethod === "mobile" && <div className="radio-dot"></div>}
                </div>
              </label>

            </div>
          </section>

        </div>

        {/* Right Column: Order Summary */}
        <div className="checkout-right-col">
          <div className="checkout-card-section checkout-summary-panel">
            <h2 className="checkout-section-title" style={{ borderBottom: "1px solid var(--color-outline-variant)", paddingBottom: "8px", marginBottom: "16px" }}>
              <span className="material-symbols-outlined" style={{ marginRight: "8px" }}>shopping_cart</span>
              Order Summary
            </h2>

            {/* Scrollable list of items */}
            <div className="order-items-scroll">
              {trayItems.length > 0 ? (
                trayItems.map((item) => (
                  <div key={item.id} className="order-item-summary-row">
                    <div className="order-item-summary-left">
                      <div className="order-item-summary-image-wrapper">
                        <img src={item.image} alt={item.name} className="order-item-summary-image" />
                      </div>
                      <div>
                        <h3 className="order-item-summary-name">{item.name}</h3>
                        <p className="order-item-summary-qty">x{item.quantity}</p>
                      </div>
                    </div>
                    <span className="order-item-summary-price">KES {formatKES(item.price * item.quantity)}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-on-surface-variant)" }}>
                  <p>Your tray is empty.</p>
                </div>
              )}
            </div>

            {/* Calculations & Order placement */}
            <div className="summary-totals-area">
              <div className="summary-total-item">
                <span>Subtotal</span>
                <span>KES {formatKES(subtotal)}</span>
              </div>
              <div className="summary-total-item">
                <span>Tax (8%)</span>
                <span>KES {formatKES(tax)}</span>
              </div>
              <div className="summary-total-row-bold">
                <span>Total</span>
                <span className="total-bold-price">KES {formatKES(total)}</span>
              </div>
            </div>

            <button 
              className="place-order-btn" 
              disabled={trayItems.length === 0}
              onClick={handlePlaceOrder}
            >
              <span className="material-symbols-outlined place-order-btn-icon" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Place Order
            </button>
            
            <p className="agreement-disclaimer">
              By placing your order, you agree to our Terms of Service.
            </p>
          </div>
        </div>

      </div>

      {/* Insufficient Balance Modal */}
      {showInsufficientBalanceModal && (
        <div 
          className="insufficient-modal-backdrop" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="insufficient-modal-title"
          onClick={() => setShowInsufficientBalanceModal(false)}
        >
          <div className="insufficient-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="insufficient-modal-icon-wrapper">
              <span className="material-symbols-outlined insufficient-modal-icon">error</span>
            </div>
            <h3 id="insufficient-modal-title" className="insufficient-modal-header">Insufficient Balance</h3>
            <div className="insufficient-modal-body">
              <p className="insufficient-modal-message">
                Your Campus Wallet does not currently have enough funds to complete this order.
              </p>
              <p className="insufficient-modal-message" style={{ fontWeight: "600", marginTop: "8px" }}>
                Please top up your wallet and try again.
              </p>
              <p className="insufficient-modal-submessage">
                We're holding your order details so you can continue once your wallet is funded.
              </p>
            </div>
            
            <div className="insufficient-modal-actions">
              <button 
                type="button" 
                className="insufficient-btn-cancel" 
                onClick={() => setShowInsufficientBalanceModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="insufficient-btn-confirm" 
                onClick={() => {
                  setShowInsufficientBalanceModal(false);
                  navigate("/wallet");
                }}
              >
                Top Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Celebration Overlay */}
      {showSuccessOverlay && (
        <div className="success-overlay-container">
          <CelebrationCanvas />
          <div className="success-overlay-card">
            <div className="success-overlay-icon-wrapper">
              <span className="material-symbols-outlined success-overlay-icon">check_circle</span>
              <div className="sparkle-sparkle spark-1">★</div>
              <div className="sparkle-sparkle spark-2">✦</div>
              <div className="sparkle-sparkle spark-3">★</div>
            </div>
            <h2 className="success-overlay-title">Order Placed Successfully!</h2>
            <div className="success-overlay-body">
              <p className="success-overlay-desc">
                Your order has been received and is now being prepared.
              </p>
              <p className="success-overlay-subdesc">
                You can track its progress from the Order Tracking page.
              </p>
            </div>
            <button 
              type="button" 
              className="success-overlay-cta"
              onClick={() => {
                setShowSuccessOverlay(false);
                navigate("/order-tracking");
              }}
            >
              <span>Track Your Order</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Checkout;
