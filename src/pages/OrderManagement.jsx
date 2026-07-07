import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import "../styles/OrderManagement.css";

// Helper to format currency
function formatKES(amount) {
  const num = parseFloat(amount) || 0;
  return "KES " + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper to format date
function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function OrderManagement() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Sidebar controls
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // States for orders data
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [paymentFilter, setPaymentFilter] = useState("All"); // "All", "Mobile Money", "Wallet"
  const [statusFilter, setStatusFilter] = useState("All Orders"); // "All Orders", "Pending", "Preparing", "Ready", "Completed"
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  // Fetch orders from Supabase with joins
  const fetchOrders = useCallback(async () => {
    try {
      // 1. Fetch completed orders via RPC
      const { data: ordersData, error: ordersErr } = await supabase
        .rpc("admin_get_all_orders");
      if (ordersErr) throw ordersErr;

      // 2. Fetch order items via RPC
      let itemsData = [];
      const { data: rpcItemsData, error: itemsErr } = await supabase
        .rpc("admin_get_all_order_items");
      if (!itemsErr && rpcItemsData) {
        itemsData = rpcItemsData;
      } else {
        console.warn("[OM] RPC admin_get_all_order_items failed, using empty array fallback:", itemsErr);
      }

      // Group items by order_id
      const itemsMap = {};
      itemsData.forEach(item => {
        if (!itemsMap[item.order_id]) {
          itemsMap[item.order_id] = [];
        }
        itemsMap[item.order_id].push({
          quantity: item.quantity,
          menu: {
            name: item.menu_name || "Meal"
          }
        });
      });

      // Extract unique chef IDs (supporting both assigned_chef_id column and notes fallback)
      const chefIds = [...new Set((ordersData || []).map(o => {
        if (o.assigned_chef_id) return o.assigned_chef_id;
        if (o.notes) {
          const match = o.notes.match(/ChefID:([a-f0-9-]+)/);
          if (match) return match[1];
        }
        return null;
      }).filter(id => id))];

      let chefMap = {};
      if (chefIds.length > 0) {
        const { data: chefsData, error: chefsErr } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", chefIds);

        if (!chefsErr && chefsData) {
          chefsData.forEach(c => {
            chefMap[c.id] = c;
          });
        }
      }

      const mappedOrders = (ordersData || []).map(o => {
        let chefId = o.assigned_chef_id;
        if (!chefId && o.notes) {
          const match = o.notes.match(/ChefID:([a-f0-9-]+)/);
          if (match) chefId = match[1];
        }
        return {
          ...o,
          chef: chefId ? chefMap[chefId] : null,
          notes: o.notes ? o.notes.replace(/ChefID:[a-f0-9-]+\s*\|?\s*/g, "").trim() : "",
          order_items: itemsMap[o.id] || []
        };
      });

      setOrders(mappedOrders);
    } catch (err) {
      console.error("[OM] Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    // Subscribe to real-time changes on orders table
    const orderSubscription = supabase
      .channel("admin_live_orders_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        console.log("[OM] Real-time update detected, reloading...");
        fetchOrders();
      })
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, [fetchOrders]);

  // Derived filtered & searched orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Payment Method Filter
      const paymentMethod = parseFloat(order.wallet_deduction) > 0 ? "Wallet" : "Mobile Money";
      if (paymentFilter !== "All" && paymentMethod !== paymentFilter) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== "All Orders") {
        if (statusFilter === "Completed" && order.status !== "collected") {
          return false;
        }
        if (statusFilter !== "Completed" && order.status !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Search Query Filter (Order ID, Student Name, Assigned Chef)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const orderIdMatch = order.id.toLowerCase().includes(query) || 
                             `STR-${order.id.substring(0, 8)}`.toLowerCase().includes(query);
        const studentMatch = (order.student_name || "").toLowerCase().includes(query);
        const chefMatch = (order.chef?.full_name || "").toLowerCase().includes(query);

        if (!orderIdMatch && !studentMatch && !chefMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, paymentFilter, statusFilter, searchQuery]);

  return (
    <div className="om-page-container">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="om-sidebar">
        <div className="om-sidebar-header">
          <div className="om-avatar-container">
            <img
              alt="Admin"
              className="om-avatar-img"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
            />
          </div>
          <div>
            <h1 className="om-admin-name">Stratizen Admin</h1>
            <p className="om-admin-role">Executive Control</p>
          </div>
        </div>

        <nav className="om-nav-menu">
          <a className="om-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="om-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/users")}>
            <span className="material-symbols-outlined">group</span>
            <span>User Management</span>
          </a>
          <a className="om-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Management</span>
          </a>
          <a className="om-nav-item active" style={{ cursor: "pointer" }}>
            <span className="material-symbols-outlined font-fill">shopping_cart</span>
            <span>Orders</span>
          </a>
          <a className="om-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/reports")}>
            <span className="material-symbols-outlined">analytics</span>
            <span>Reports & Analytics</span>
          </a>
        </nav>

        <div className="om-sidebar-footer">
          <button className="om-logout-btn" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="om-mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <aside className="om-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="om-sidebar-header">
              <div className="om-avatar-container">
                <img
                  alt="Admin"
                  className="om-avatar-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
                />
              </div>
              <div>
                <h1 className="om-admin-name">Stratizen Admin</h1>
                <p className="om-admin-role">Executive Control</p>
              </div>
            </div>
            <nav className="om-nav-menu">
              <a className="om-nav-item" onClick={() => { navigate("/admin/dashboard"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">dashboard</span>
                <span>Dashboard</span>
              </a>
              <a className="om-nav-item" onClick={() => { navigate("/admin/users"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">group</span>
                <span>User Management</span>
              </a>
              <a className="om-nav-item" onClick={() => { navigate("/admin/menu"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">restaurant_menu</span>
                <span>Menu Management</span>
              </a>
              <a className="om-nav-item active" onClick={() => setMobileMenuOpen(false)}>
                <span className="material-symbols-outlined font-fill">shopping_cart</span>
                <span>Orders</span>
              </a>
              <a className="om-nav-item" onClick={() => { navigate("/admin/reports"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">analytics</span>
                <span>Reports & Analytics</span>
              </a>
            </nav>
            <div className="om-sidebar-footer">
              <button className="om-logout-btn" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="om-main-wrapper">
        <header className="om-topbar">
          <div className="om-topbar-left">
            <button className="om-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="om-brand-title">Stratizen Cafeteria</h2>
          </div>
          <div className="om-topbar-right" />
        </header>

        <main className="om-main-canvas">
          {/* Page Header */}
          <div className="om-page-header">
            <div>
              <h1 className="om-page-title">Order Management</h1>
              <p className="om-page-subtitle">Track, filter, and audit live student orders and preparation queues.</p>
            </div>
          </div>

          {/* Filters & Control Bar */}
          <div className="om-toolbar-card">
            {/* Search Input */}
            <div className="om-toolbar-search">
              <span className="material-symbols-outlined">search</span>
              <input
                className="om-toolbar-input"
                placeholder="Search by Order ID, Student, or Chef..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Segmented Payment Filter */}
            <div className="om-segmented-filter">
              <span className="om-filter-label">Payment Method:</span>
              <div className="om-segmented-group">
                {["All", "Mobile Money", "Wallet"].map((method) => (
                  <button
                    key={method}
                    className={`om-segmented-btn ${paymentFilter === method ? "active" : ""}`}
                    onClick={() => setPaymentFilter(method)}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdown Status Filter */}
            <div className="om-dropdown-filter">
              <span className="om-filter-label">Status:</span>
              <div className="om-select-wrapper">
                <select
                  className="om-status-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {["All Orders", "Pending", "Preparing", "Ready", "Completed"].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined om-select-arrow">expand_more</span>
              </div>
            </div>
          </div>

          {/* Orders Cards Grid Container */}
          <div className="om-content-card" style={{ padding: "0" }}>
            {loading ? (
              <div className="om-loading-state">
                <div className="om-spinner" />
                <p>Loading live order stream...</p>
              </div>
            ) : (
              <>
                {filteredOrders.length === 0 ? (
                  <div className="om-loading-state">
                    <span className="material-symbols-outlined" style={{ fontSize: "48px", opacity: "0.5" }}>shopping_cart</span>
                    <p style={{ fontStyle: "italic" }}>
                      {searchQuery || paymentFilter !== "All" || statusFilter !== "All Orders"
                        ? "No orders match your filter criteria."
                        : "No orders have been placed today."}
                    </p>
                  </div>
                ) : (
                  <div className="om-cards-grid">
                    {filteredOrders.map((order) => {
                      const paymentMethod = parseFloat(order.wallet_deduction) > 0 ? "Wallet" : "Mobile Money";
                      const displayId = `STR-${order.id.substring(0, 8).toUpperCase()}`;
                      const itemsOrdered = (order.order_items || [])
                        .map((oi) => `${oi.quantity}x ${oi.menu?.name || "Meal"}`)
                        .join(", ");

                      let statusLabel = "Pending";
                      let statusClass = "pending";
                      if (order.status === "preparing") {
                        statusLabel = "Preparing";
                        statusClass = "preparing";
                      } else if (order.status === "ready") {
                        statusLabel = "Ready";
                        statusClass = "ready";
                      } else if (order.status === "collected" || order.status === "completed") {
                        statusLabel = "Completed";
                        statusClass = "completed";
                      }

                      return (
                        <div key={order.id} className="om-order-card">
                          <div className="om-card-header">
                            <span className="om-card-id">{displayId}</span>
                            <span className={`om-status-pill ${statusClass}`}>{statusLabel}</span>
                          </div>
                          
                          <div className="om-card-body">
                            <div className="om-info-row">
                              <span className="material-symbols-outlined om-info-icon">person</span>
                              <span className="om-info-value bold">{order.student_name}</span>
                            </div>
                            
                            <div className="om-info-row">
                              <span className="material-symbols-outlined om-info-icon">schedule</span>
                              <span className="om-info-value">{formatDate(order.created_at)}</span>
                            </div>
                            
                            <div className="om-info-row">
                              <span className="material-symbols-outlined om-info-icon">payments</span>
                              <span className="om-info-value">
                                <span className={`om-payment-pill ${paymentMethod.toLowerCase().replace(" ", "-")}`}>
                                  {paymentMethod}
                                </span>
                              </span>
                            </div>
                            
                            <div className="om-info-row">
                              <span className="material-symbols-outlined om-info-icon">restaurant_menu</span>
                              <span className="om-info-value om-items-text" title={itemsOrdered}>
                                {itemsOrdered || "—"}
                              </span>
                            </div>
                            
                            <div className="om-info-row">
                              <span className="material-symbols-outlined om-info-icon">restaurant</span>
                              <span className="om-info-value">
                                {order.chef?.full_name ? (
                                  <span className="om-chef-badge" style={{ padding: "2px 8px" }}>
                                    {order.chef.full_name}
                                  </span>
                                ) : (
                                  <span className="om-unassigned">Unassigned</span>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          <div className="om-card-footer">
                            <span className="om-total-label">Total Amount</span>
                            <span className="om-total-value">{formatKES(order.total)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="om-table-footer">
                  Showing {filteredOrders.length} of {orders.length} orders
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default OrderManagement;
