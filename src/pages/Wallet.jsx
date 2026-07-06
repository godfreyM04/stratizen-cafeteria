import { useState, useEffect } from "react";
import AuthLayout from "../components/AuthLayout";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
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

function Wallet() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDepositing, setIsDepositing] = useState(false);

  const loadWalletData = async () => {
    if (!user) return;
    try {
      console.log(`[Wallet] Loading wallet and transaction data for user: ${user.id}`);
      
      // 1. Fetch wallet balance
      let { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (walletError) {
        console.error("[Wallet] Fetch balance query error:", walletError);
        throw walletError;
      }

      // If wallet record does not exist, create one automatically initialized to KES 0.00
      if (!wallet) {
        console.log("[Wallet] Wallet record not found. Initializing wallet to KES 0.00...");
        const { data: newWallet, error: createError } = await supabase
          .from("wallets")
          .insert({ user_id: user.id, balance: 0.00 })
          .select()
          .single();

        if (createError) {
          console.error("[Wallet] Failed to initialize new wallet record:", {
            code: createError.code,
            message: createError.message,
            details: createError.details
          });
          throw createError;
        }
        wallet = newWallet;
        console.log("[Wallet] Wallet initialized successfully:", wallet);
      }
      
      if (wallet) {
        setBalance(parseFloat(wallet.balance));
      }

      // 2. Fetch transaction history
      const { data: txs, error: txsError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (txsError) {
        console.error("[Wallet] Fetch transactions query error:", txsError);
        throw txsError;
      }

      // Map DB transactions to UI structure
      const mapped = (txs || []).map(tx => ({
        id: tx.id,
        type: tx.type,
        title: tx.type === "deposit" ? "Deposit using M-Pesa" : "Main Dining Hall",
        desc: tx.description || (tx.type === "deposit" ? "Manual Deposit" : "Food Purchase"),
        timestamp: tx.created_at,
        amount: parseFloat(tx.amount)
      }));
      setTransactions(mapped);
    } catch (err) {
      console.error("[Wallet] Failed to load wallet details:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    loadWalletData();

    // Subscribe to wallet balance changes in real-time
    const walletSubscription = supabase
      .channel(`wallet_balance_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            console.log("[Wallet] Real-time wallet update received:", payload.new);
            setBalance(parseFloat(payload.new.balance));
          }
        }
      )
      .subscribe();

    // Subscribe to transactions in real-time
    const txSubscription = supabase
      .channel(`wallet_txs_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            console.log("[Wallet] Real-time transaction insert received:", payload.new);
            const tx = payload.new;
            const newTx = {
              id: tx.id,
              type: tx.type,
              title: tx.type === "deposit" ? "Deposit using M-Pesa" : "Main Dining Hall",
              desc: tx.description || (tx.type === "deposit" ? "Manual Deposit" : "Food Purchase"),
              timestamp: tx.created_at,
              amount: parseFloat(tx.amount)
            };
            setTransactions(prev => {
              // Avoid duplicates if already fetched
              if (prev.some(t => t.id === tx.id)) return prev;
              return [newTx, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      walletSubscription.unsubscribe();
      txSubscription.unsubscribe();
    };
  }, [user]);

  const handleDepositClick = () => {
    setShowDepositModal(true);
  };

  const handleModalClose = () => {
    setShowDepositModal(false);
    setDepositAmount("");
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }

    setIsDepositing(true);
    console.log(`[Wallet] Initiating atomic deposit of KES ${amount} for user: ${user.id}`);

    try {
      // Execute the atomic deposit RPC in Supabase
      const { data: newBalance, error: rpcError } = await supabase.rpc("deposit_funds", {
        p_user_id: user.id,
        p_amount: amount
      });

      if (rpcError) {
        console.error("[Wallet] Deposit RPC transaction failed:", {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details
        });

        let userMessage = "Failed to deposit funds. Please try again.";
        if (rpcError.code === "42501") {
          userMessage = "Permission denied. Row Level Security policies do not authorize this update.";
        } else if (rpcError.code === "23514") {
          userMessage = "Deposit amount is invalid or violates wallet limits.";
        } else if (rpcError.message?.includes("violates row-level security policy")) {
          userMessage = "Security policy violation: You do not have permissions to modify this wallet.";
        } else if (rpcError.message) {
          userMessage = `Database error: ${rpcError.message}`;
        }
        
        alert(userMessage);
        setIsDepositing(false);
        return;
      }

      console.log(`[Wallet] Atomic deposit successful. New balance returned: KES ${newBalance}`);
      
      // Optimistic/Immediate UI update
      setBalance(parseFloat(newBalance));
      
      // Force reload transaction list to catch the new ledger record
      await loadWalletData();

      addToast(`Successfully deposited KES ${formatKES(amount)} using M-Pesa!`);
      handleModalClose();
    } catch (err) {
      console.error("[Wallet] Submit handler caught error:", err);
      alert(err.message || "Failed to process deposit. Please check your connection.");
    } finally {
      setIsDepositing(false);
    }
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
        const txTime = new Date(tx.timestamp).getTime();
        return txTime >= dayStart && txTime < dayEnd;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    return total;
  });

  const maxSpend = Math.max(...dailySpends);
  const todayDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-md">
          <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
          <p className="text-on-surface-variant font-medium">Loading wallet details...</p>
        </div>
      </AuthLayout>
    );
  }

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
              <button className="deposit-button cursor-pointer border-none" onClick={handleDepositClick}>
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
                  className="view-all-btn cursor-pointer border-none bg-transparent" 
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
                        onClick={() => alert(`Transaction Details:\n\nTitle: ${tx.title}\nDescription: ${tx.desc}\nTime: ${formatTransactionTimestamp(tx.timestamp)}\nAmount: ${isDeposit ? "+" : "-"}KES ${formatKES(tx.amount)}`)}
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
                              {formatTransactionTimestamp(tx.timestamp)} • {tx.desc}
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
                  <button type="button" className="modal-btn-cancel cursor-pointer border-none" onClick={handleModalClose} disabled={isDepositing}>Cancel</button>
                  <button type="submit" className="modal-btn-confirm cursor-pointer border-none" disabled={isDepositing}>
                    {isDepositing ? "Depositing..." : "Deposit"}
                  </button>
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
