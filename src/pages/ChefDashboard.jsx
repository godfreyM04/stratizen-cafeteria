import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/ChefDashboard.css";

function ChefDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Dashboard Stats State
  const [stats, setStats] = useState({
    pending: 12,
    preparing: 8,
    ready: 5,
    completed: 142
  });

  // Orders State
  const [orders, setOrders] = useState([
    {
      id: 2481,
      name: "Sarah Jenkins",
      items: "1x Grilled Salmon Bowl, 1x Iced Matcha",
      time: "Placed 2m ago",
      status: "pending"
    },
    {
      id: 2482,
      name: "Marcus Thorne",
      items: "2x Spicy Tofu Ramen (Extra Spice)",
      time: "Placed 5m ago",
      status: "pending"
    },
    {
      id: 2483,
      name: "Elena Rodriguez",
      items: "1x Chicken Caesar Salad, 1x Garlic Bread",
      time: "Placed 8m ago",
      status: "pending"
    },
    {
      id: 2484,
      name: "Jordan Wu",
      items: "3x Falafel Wraps, 3x Hummus Sides",
      time: "Placed 12m ago",
      status: "pending"
    }
  ]);

  // Track processing state for each order button
  const [processingOrders, setProcessingOrders] = useState({});

  const handleStartPreparing = (orderId) => {
    // Set order as processing
    setProcessingOrders(prev => ({ ...prev, [orderId]: true }));

    // Simulate cooking start animation
    setTimeout(() => {
      // Remove order from list and update stats
      setOrders(prevOrders => prevOrders.filter(o => o.id !== orderId));
      setStats(prevStats => ({
        ...prevStats,
        pending: Math.max(0, prevStats.pending - 1),
        preparing: prevStats.preparing + 1
      }));
      // Clear processing status
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

  return (
    <div className="chef-dashboard-container">
      {/* SideNavBar */}
      <aside className="chef-sidebar">
        <div className="chef-sidebar-brand">
          <div className="chef-brand-logo">
            <span className="material-symbols-outlined fill-icon">restaurant</span>
            <h1>Stratizen</h1>
          </div>
          <p className="chef-brand-subtitle">Chef Management Portal</p>
        </div>
        
        <nav className="chef-sidebar-nav">
          <div className="chef-nav-item active">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Kitchen Dashboard</span>
          </div>
          <div className="chef-nav-item">
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Order Queue</span>
          </div>
          <div className="chef-nav-item">
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Manager</span>
          </div>
          <div className="chef-nav-item">
            <span className="material-symbols-outlined">bar_chart</span>
            <span>Analytics</span>
          </div>
          <div className="chef-nav-item">
            <span className="material-symbols-outlined">groups</span>
            <span>Staff Settings</span>
          </div>
        </nav>

        <div className="chef-sidebar-footer">
          <button className="chef-footer-btn">
            <span className="material-symbols-outlined">help</span>
            <span>Help Center</span>
          </button>
          <button className="chef-footer-btn logout" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="chef-main-content">
        {/* TopAppBar */}
        <header className="chef-header">
          <div className="chef-header-search">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search orders or items..." />
          </div>
          
          <div className="chef-header-actions">
            <button className="chef-action-btn notification">
              <span className="material-symbols-outlined">notifications</span>
              <span className="notification-badge"></span>
            </button>
            <button className="chef-action-btn">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="chef-header-divider"></div>
            <div className="chef-profile-widget">
              <div className="chef-profile-info">
                <p className="chef-profile-name">Chef Anderson</p>
                <p className="chef-profile-role">Executive Chef</p>
              </div>
              <img 
                className="chef-profile-avatar" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEcZCcEVpXa-MozwkTjzFQVIHYcYYM5akFrOMnj_D_vvqsfynOXdhbY75zobj4CTHb8jYUJoC-1tpYQLa3RrbBnwrmwvylrIRJ_DJaBLS0lAmOCvpaGz6Yafdw53X1sisa6nnDEP2oGCk-aWh3JpRv1hVf50hHdfL5KXrrmZUK_mfWAhSiVkP7MZSX602-XhGAL5NA-z_LKpjE3Vw5ipDGT703O6ivUTY1IMLDg-VhuvorjqcnwiYPMzJbhgmGsdbxAOJjYc9I_g"
                alt="Chef Anderson avatar" 
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="chef-dashboard-content">
          {/* Summary Bento Grid */}
          <section className="chef-bento-grid">
            {/* Pending */}
            <div className="chef-bento-card pending">
              <div className="chef-card-header">
                <div>
                  <p className="chef-card-label">Pending Orders</p>
                  <h2 className="chef-card-value">{stats.pending < 10 ? `0${stats.pending}` : stats.pending}</h2>
                </div>
                <span className="material-symbols-outlined card-icon">pending_actions</span>
              </div>
              <p className="chef-card-trend">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                2 new in the last 5 mins
              </p>
            </div>

            {/* Preparing */}
            <div className="chef-bento-card preparing">
              <div className="chef-card-header">
                <div>
                  <p className="chef-card-label">Preparing</p>
                  <h2 className="chef-card-value">{stats.preparing < 10 ? `0${stats.preparing}` : stats.preparing}</h2>
                </div>
                <span className="material-symbols-outlined card-icon">chef_hat</span>
              </div>
              <p className="chef-card-trend">Avg. time: 14 mins</p>
            </div>

            {/* Ready */}
            <div className="chef-bento-card ready">
              <div className="chef-card-header">
                <div>
                  <p className="chef-card-label">Ready to Collect</p>
                  <h2 className="chef-card-value">{stats.ready < 10 ? `0${stats.ready}` : stats.ready}</h2>
                </div>
                <span className="material-symbols-outlined card-icon">hourglass_empty</span>
              </div>
              <p className="chef-card-trend">Awaiting student pickup</p>
            </div>

            {/* Completed */}
            <div className="chef-bento-card completed">
              <div className="chef-card-header">
                <div>
                  <p className="chef-card-label">Completed</p>
                  <h2 className="chef-card-value">{stats.completed}</h2>
                </div>
                <span className="material-symbols-outlined card-icon">check_circle</span>
              </div>
              <p className="chef-card-trend">Goal: 200 orders</p>
            </div>
          </section>

          {/* Main Operational Area */}
          <div className="chef-ops-section">
            {/* Incoming Orders List */}
            <section className="chef-orders-queue">
              <div className="chef-section-header">
                <h3>Incoming Orders</h3>
                <button className="chef-text-link">
                  View All Queue <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>
              
              <div className="chef-orders-list">
                {orders.length === 0 ? (
                  <div className="chef-empty-queue">
                    <span className="material-symbols-outlined">done_all</span>
                    <p>All orders have been prepared!</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="chef-order-row">
                      <div className="chef-order-details-col">
                        <div className="chef-ticket-badge">
                          <p className="chef-ticket-title">Ticket</p>
                          <p className="chef-ticket-num">#{order.id}</p>
                        </div>
                        <div className="chef-order-info">
                          <h4>{order.name}</h4>
                          <p>{order.items}</p>
                        </div>
                      </div>
                      <div className="chef-order-actions-col">
                        <span className="chef-order-time">{order.time}</span>
                        <button 
                          className={`chef-btn-prepare ${processingOrders[order.id] ? 'processing' : ''}`}
                          onClick={() => handleStartPreparing(order.id)}
                          disabled={processingOrders[order.id]}
                        >
                          {processingOrders[order.id] ? (
                            <span className="chef-loading-span">
                              <span className="animate-spin material-symbols-outlined">sync</span>
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

            {/* Peak Activity Chart */}
            <section className="chef-chart-container">
              <div className="chef-chart-card">
                <div className="chef-section-header">
                  <h3>Peak Activity</h3>
                  <span className="chef-badge-today">Today</span>
                </div>
                
                {/* Visual Chart */}
                <div className="chef-activity-chart">
                  <div className="chef-chart-grid-lines">
                    <div className="chef-grid-line"></div>
                    <div className="chef-grid-line"></div>
                    <div className="chef-grid-line"></div>
                  </div>
                  
                  <div className="chef-chart-bars">
                    <div className="chef-chart-bar-col group">
                      <div className="chef-chart-bar" style={{height: "40%"}}>
                        <div className="chef-chart-tooltip">24 Orders</div>
                      </div>
                    </div>
                    <div className="chef-chart-bar-col group">
                      <div className="chef-chart-bar" style={{height: "60%"}}>
                        <div className="chef-chart-tooltip">42 Orders</div>
                      </div>
                    </div>
                    <div className="chef-chart-bar-col group">
                      <div className="chef-chart-bar active" style={{height: "95%"}}>
                        <div className="chef-chart-tooltip">86 Orders</div>
                      </div>
                    </div>
                    <div className="chef-chart-bar-col group">
                      <div className="chef-chart-bar" style={{height: "55%"}}>
                        <div className="chef-chart-tooltip">38 Orders</div>
                      </div>
                    </div>
                    <div className="chef-chart-bar-col group">
                      <div className="chef-chart-bar" style={{height: "75%"}}>
                        <div className="chef-chart-tooltip">62 Orders</div>
                      </div>
                    </div>
                    <div className="chef-chart-bar-col group">
                      <div className="chef-chart-bar" style={{height: "35%"}}>
                        <div className="chef-chart-tooltip">18 Orders</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="chef-chart-labels">
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
        <footer className="chef-footer">
          <p>© 2024 Stratizen University Dining. System status: <span className="status-operational">Operational</span></p>
        </footer>
      </main>
    </div>
  );
}

export default ChefDashboard;
