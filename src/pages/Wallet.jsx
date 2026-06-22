import { useState, useEffect } from "react";
import AuthLayout from "../components/AuthLayout";
import { useToast } from "../context/ToastContext";
import "../styles/Wallet.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to get start of the current week (Monday)
const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.getFullYear(), d.getMonth(), diff);
};

const formatTransactionTimestamp = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp; // fallback
  
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

// Initial default transactions matching the Stitch design system exactly, with dynamic timestamps
const DEFAULT_TRANSACTIONS = [
  { id: "tx-1", type: "purchase", title: "Main Dining Hall", desc: "Lunch Combo", timestamp: new Date(new Date().setHours(12, 45, 0, 0)).toISOString(), amount: 12.50 },
  { id: "tx-2", type: "purchase", title: "Science Bldg Cafe", desc: "Iced Latte", timestamp: new Date(new Date().setHours(9, 15, 0, 0)).toISOString(), amount: 4.75 },
  { id: "tx-3", type: "deposit", title: "Deposit using M-Pesa", desc: "Auto-Reload", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), amount: 50.00 },
  { id: "tx-4", type: "purchase", title: "Late Night Grill", desc: "Burger & Fries", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), amount: 14.20 },
  { id: "tx-5", type: "purchase", title: "Library Kiosk", desc: "Muffin & Tea", timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), amount: 6.50 },
];

function Wallet() {
  const { addToast } = useToast();

  const [balance, setBalance] = useState(() => {
    const cached = localStorage.getItem("stratizen_wallet_balance");
    return cached ? parseFloat(cached) : 42.50; // Stitch design starts with KES 42.50
  });

  const [transactions, setTransactions] = useState(() => {
    const cached = localStorage.getItem("stratizen_wallet_transactions");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error("Error parsing cached transactions:", err);
      }
    }
    return DEFAULT_TRANSACTIONS;
  });

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem("stratizen_wallet_balance", balance.toFixed(2));
  }, [balance]);

  useEffect(() => {
    localStorage.setItem("stratizen_wallet_transactions", JSON.stringify(transactions));
  }, [transactions]);

  const handleDepositClick = () => {
    setShowDepositModal(true);
  };

  const handleModalClose = () => {
    setShowDepositModal(false);
    setDepositAmount("");
  };

  const handleDepositSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }

    // Update balance
    const nextBalance = balance + amount;
    setBalance(nextBalance);

    // Create deposit transaction
    const newTx = {
      id: "tx-dep-" + Date.now(),
      type: "deposit",
      title: "Deposit using M-Pesa",
      desc: "Manual Deposit",
      timestamp: new Date().toISOString(),
      amount: amount
    };

    setTransactions((prevTx) => [newTx, ...prevTx]);
    addToast(`Successfully deposited KES ${formatKES(amount)} using M-Pesa!`);
    handleModalClose();
  };

  // Calculate spending dynamically
  const startOfWeek = getStartOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const dailySpends = weekDays.map((day) => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    
    // Sum purchases made on this day
    const total = transactions
      .filter((tx) => {
        if (tx.type !== "purchase") return false;
        const txTime = new Date(tx.timestamp || tx.time).getTime();
        return txTime >= dayStart && txTime < dayEnd;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    return total;
  });

  const maxSpend = Math.max(...dailySpends);
  const todayDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <AuthLayout>
      <div className="wallet-page-container">
        {/* Header Section */}
        <header className="wallet-header-section">
          <h1 className="wallet-title">Digital Wallet</h1>
          <p className="wallet-subtitle">Manage your dining funds, view history, and top up seamlessly.</p>
        </header>

        {/* Grid Area */}
        <div className="wallet-grid">
          
          {/* Left Column */}
          <div className="wallet-left-col">
            
            {/* Balance Card */}
            <div className="balance-card-container">
              <p className="balance-label">Current Balance</p>
              <h2 className="balance-amount">KES {formatKES(balance)}</h2>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions-row">
              <button className="deposit-button" onClick={handleDepositClick}>
                <span className="material-symbols-outlined">add_circle</span>
                Deposit Funds
              </button>
            </div>

            {/* Weekly Spending Chart */}
            <div className="glass-card chart-card">
              <h3 className="chart-title">Weekly Spending</h3>
              <div className="chart-relative-container">
                <div className="chart-grid-bg"></div>
                
                {/* Bars Layer */}
                <div className="chart-bars-layer">
                  {weekDays.map((day, idx) => {
                    const spend = dailySpends[idx];
                    const isToday = idx === todayDayIndex;
                    const heightPercent = maxSpend > 0 ? (spend / maxSpend) * 80 + 10 : 10;
                    const hasSpend = spend > 0;
                    
                    return (
                      <div
                        key={idx}
                        className={`chart-bar-col ${
                          isToday
                            ? "chart-bar-active"
                            : hasSpend
                              ? "chart-bar-inactive"
                              : "chart-bar-empty"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      >
                        {hasSpend && (
                          <span className="chart-tooltip">
                            KES {formatKES(spend)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* X Axis Labels */}
                <div className="chart-x-axis">
                  {dayLabels.map((label, idx) => {
                    const isToday = idx === todayDayIndex;
                    return (
                      <span key={idx} className={isToday ? "chart-day-active" : ""}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Transaction History */}
          <div className="wallet-right-col">
            <div className="glass-card transactions-card">
              <div className="transactions-card-header">
                <h2 className="transactions-card-title">
                  <span className="material-symbols-outlined transactions-title-icon">history</span>
                  Transaction History
                </h2>
                <button 
                  className="view-all-btn" 
                  onClick={() => alert("Detailed statement download coming soon!")}
                >
                  View All
                </button>
              </div>

              {/* Transactions List */}
              <div className="transactions-scroll-area">
                {transactions.length > 0 ? (
                  transactions.map((tx) => {
                    const isDeposit = tx.type === "deposit";
                    return (
                      <div 
                        key={tx.id} 
                        className={`transaction-row ${isDeposit ? "transaction-row-deposit" : ""}`}
                        onClick={() => alert(`Transaction Details:\n\nTitle: ${tx.title}\nDescription: ${tx.desc}\nTime: ${formatTransactionTimestamp(tx.timestamp || tx.time)}\nAmount: ${isDeposit ? "+" : "-"}KES ${formatKES(tx.amount)}`)}
                      >
                        <div className="transaction-left-block">
                          <div className={`tx-icon-wrapper ${
                            isDeposit 
                              ? "tx-icon-bg-deposit" 
                              : tx.title.toLowerCase().includes("cafe") 
                                ? "tx-icon-bg-cafe" 
                                : "tx-icon-bg-purchase"
                          }`}>
                            <span className="material-symbols-outlined">
                              {isDeposit 
                                ? "account_balance" 
                                : tx.title.toLowerCase().includes("cafe") 
                                  ? "local_cafe" 
                                  : "restaurant"
                              }
                            </span>
                          </div>
                          <div className="tx-details">
                            <h4 className="tx-title">{tx.title}</h4>
                            <p className="tx-time-desc">
                              {formatTransactionTimestamp(tx.timestamp || tx.time)} • {tx.desc}
                            </p>
                          </div>
                        </div>
                        <div className="tx-right-block">
                          <p className={`tx-amount ${isDeposit ? "tx-amount-deposit" : "tx-amount-debit"}`}>
                            {isDeposit ? "+" : "-"}KES {formatKES(tx.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-on-surface-variant)" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "48px", marginBottom: "8px" }}>history_toggle_off</span>
                    <p>No transactions found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Deposit Modal */}
        {showDepositModal && (
          <div className="deposit-modal-backdrop" onClick={handleModalClose}>
            <div className="deposit-modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-header">Deposit Funds</h3>
              <p className="modal-description">Enter the amount you wish to transfer from your M-Pesa account to your cafeteria wallet.</p>
              
              <form onSubmit={handleDepositSubmit}>
                <div className="deposit-input-wrapper">
                  <label className="deposit-input-label" htmlFor="amount">Amount (KES)</label>
                  <input
                    autoFocus
                    required
                    className="deposit-input-box"
                    id="amount"
                    min="1"
                    name="amount"
                    placeholder="e.g. 50.00"
                    step="0.01"
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="modal-btn-cancel" onClick={handleModalClose}>Cancel</button>
                  <button type="submit" className="modal-btn-confirm">Deposit</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

export default Wallet;
