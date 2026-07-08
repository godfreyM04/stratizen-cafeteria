import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SharedOrderHistory from "../components/SharedOrderHistory";
import "../styles/ReportsAnalytics.css";

function ReportsAnalytics() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Navigation states
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <div className="ra-page-container">
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <aside className="ra-sidebar">
        <div className="ra-sidebar-header">
          <div className="ra-avatar-container">
            <img
              alt="Admin"
              className="ra-avatar-img"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
            />
          </div>
          <div>
            <h1 className="ra-admin-name">Stratizen Admin</h1>
            <p className="ra-admin-role">Executive Control</p>
          </div>
        </div>

        <nav className="ra-nav-menu">
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/users")}>
            <span className="material-symbols-outlined">group</span>
            <span>User Management</span>
          </a>
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span>Menu Management</span>
          </a>
          <a className="ra-nav-item" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/orders")}>
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>Orders</span>
          </a>
          <a className="ra-nav-item active" style={{ cursor: "pointer" }}>
            <span className="material-symbols-outlined font-fill">analytics</span>
            <span>Reports & Analytics</span>
          </a>
        </nav>

        <div className="ra-sidebar-footer">
          <button className="ra-logout-btn" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="ra-mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <aside className="ra-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="ra-mobile-drawer-header">
              <div className="ra-avatar-container">
                <img
                  alt="Admin"
                  className="ra-avatar-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvay2r62p8NstPRWDQVnEvG2a5vkKXxPyO2Cmyl11qxE2ADe4uby2WEcxF7lwhWBH8SELW1nE22f6_wKMfYrCCe2T9zjV2XwDQZ9yGx_HHpse8XN1HoQP-7EZAZVJA5xIKNSmR9A7nQySzL98aNUshx39dwqVhPQXMu7aOHTYENx5lXWiynf_o7w6mO2r5bTFcRlWgLfzY0lZ0Rv7D3a_bS7b6EqppLWAJEWqrX2LvJwiBWt4qbRc"
                />
              </div>
              <div>
                <h1 className="ra-admin-name">Stratizen Admin</h1>
                <p className="ra-admin-role">Executive Control</p>
              </div>
            </div>
            <nav className="ra-nav-menu">
              <a className="ra-nav-item" onClick={() => { navigate("/admin/dashboard"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">dashboard</span>
                <span>Dashboard</span>
              </a>
              <a className="ra-nav-item" onClick={() => { navigate("/admin/users"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">group</span>
                <span>User Management</span>
              </a>
              <a className="ra-nav-item" onClick={() => { navigate("/admin/menu"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">restaurant_menu</span>
                <span>Menu Management</span>
              </a>
              <a className="ra-nav-item" onClick={() => { navigate("/admin/orders"); setMobileMenuOpen(false); }}>
                <span className="material-symbols-outlined">shopping_cart</span>
                <span>Orders</span>
              </a>
              <a className="ra-nav-item active" onClick={() => setMobileMenuOpen(false)}>
                <span className="material-symbols-outlined font-fill">analytics</span>
                <span>Reports & Analytics</span>
              </a>
            </nav>
            <div className="ra-sidebar-footer">
              <button className="ra-logout-btn" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="ra-main-wrapper">
        <header className="ra-topbar">
          <div className="ra-topbar-left">
            <button className="ra-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="ra-brand-title">Stratizen Cafeteria</h2>
          </div>
          <div className="ra-topbar-right" />
        </header>

        <main className="ra-main-canvas" style={{ padding: 0 }}>
          <SharedOrderHistory role="admin" isEmbedded={true} />
        </main>
      </div>
    </div>
  );
}

export default ReportsAnalytics;
