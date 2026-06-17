import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTray } from "../context/TrayContext";
import "../styles/Menu.css";
import "../styles/Orders.css";

const AuthLayout = ({ children, onSearchChange }) => {
  const { user, profile } = useAuth();
  const { itemCount } = useTray();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState("");

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  const isMenuPage = location.pathname === "/menu" || location.pathname === "/";

  return (
    <div className="auth-layout-wrapper">
      {/* TopNavBar */}
      <header className="navbar-header">
        <div className="navbar-left">
          <Link to="/menu" className="navbar-logo-link" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="material-symbols-outlined icon-fill" style={{ fontSize: "32px", color: "var(--color-primary)" }}>restaurant</span>
            <span className="navbar-brand-name">Stratizen Cafeteria</span>
          </Link>
        </div>

        <nav className="navbar-navigation">
          <Link 
            to="/menu" 
            className={`navbar-nav-item ${isMenuPage ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span className="material-symbols-outlined">menu_book</span>
            Menu
          </Link>
          <Link 
            to="/orders" 
            className={`navbar-nav-item ${location.pathname === "/orders" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              <span className={`material-symbols-outlined ${location.pathname === "/orders" ? "icon-fill" : ""}`}>room_service</span>
              {itemCount > 0 && (
                <span className="cart-badge-indicator">{itemCount}</span>
              )}
            </span>
            Tray
          </Link>
          <a 
            href="#" 
            onClick={(e) => { e.preventDefault(); alert("Wallet page coming soon!"); }}
            className="navbar-nav-item"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
            Wallet
          </a>
        </nav>

        <div className="navbar-right">
          {isMenuPage && (
            <div className="navbar-search-wrapper">
              <input 
                type="text" 
                className="navbar-search-input"
                placeholder="Search menu..."
                value={searchValue}
                onChange={handleSearchInput}
              />
              <span className="material-symbols-outlined search-icon">search</span>
            </div>
          )}

          <button 
            aria-label="dark_mode" 
            className="navbar-theme-toggle"
            onClick={() => alert("Theme toggle coming soon!")}
          >
            <span className="material-symbols-outlined">dark_mode</span>
          </button>

          <div 
            className="navbar-profile-trigger"
            onClick={() => alert(`Logged in as: ${profile?.full_name || user?.email || "Student"}`)}
          >
            <img 
              alt="User profile avatar" 
              className="navbar-profile-avatar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1dcizJY4Y11TyrZBG7Gaw1LjiiDVXE3KkpEspcKsuBvA4hdwTiDbNuecIy2Liv8i_yu39-2EhEG3-t8c9Xi_AECkU4lPGRChl-22iiBnhwGztaGiQxdY3C9VRTP8QiF-AKNuFTb-1mhjn5RgdJwAf2y3qCzuGU_aEUMimzwO-MKRRVk4NxFXTS34LIkUj2sV30Rg9DTT9Amk1g5qWneIvvoPfhXNtHgqjDP2zAvoY-H-J3lTwfCUy_V8W-yI1udVQGIWh0PzBFQ"
            />
            <span className="navbar-profile-label">Profile</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="auth-main-content">
        {children}
      </main>

      {/* Footer Component */}
      <footer className="footer-container">
        <div className="footer-content-wrapper">
          <div className="footer-brand-column">
            <span className="footer-brand-name">Stratizen Cafeteria</span>
            <p className="footer-brand-tagline">
              Powering academic excellence through nutrition and efficient campus dining services.
            </p>
          </div>
          
          <div className="footer-links-row">
            <a href="#" onClick={(e) => { e.preventDefault(); alert("About Us page"); }} className="footer-link">About Us</a>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Support page"); }} className="footer-link">Contact Support</a>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Privacy policy"); }} className="footer-link">Privacy Policy</a>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of service"); }} className="footer-link">Terms of Service</a>
          </div>

          <div className="footer-copyright-column">
            <p className="footer-copyright-text">© 2024 Stratizen University Dining Services. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
