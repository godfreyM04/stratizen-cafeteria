import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTray } from "../context/TrayContext";
import "../styles/Menu.css";
import "../styles/Orders.css";
import "../styles/OrderTracking.css";
import "../styles/ProfileSidebar.css";

const FALLBACK_AVATAR = "https://lh3.googleusercontent.com/aida-public/AB6AXuDuapRF6LkMRNQdxEwpOqireFdnQLvvnzjBERyeSMWaehS9BnRyGv4gUDcSx2FFjeL7f3ngzT-KeTysWl7SFcWaHfA-GdLVsYt8IbTNN9pBuN3ZY7RgtpgMO8x0plJhFjL_l9ro5ATYKTkR7f0YRgX6u8FvxS4AMUX4Hgb_YaPW3DzFlA5Qm15jeBwc5nfsd3DCBXOt8_1WRMT3BzhflBJIsCs7GAMD2whvb-GdqmcBHY7HtLLfeC9toHO3XYHIntMEngJuDJMC1A";

const AuthLayout = ({ children, onSearchChange }) => {
  const { user, profile, logout } = useAuth();
  const { itemCount } = useTray();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [activeOrder, setActiveOrder] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || FALLBACK_AVATAR;

  // Monitor active order state
  useEffect(() => {
    const checkActiveOrder = () => {
      try {
        const stored = localStorage.getItem("stratizen_active_order");
        if (stored) {
          const parsed = JSON.parse(stored);
          
          if (parsed.status === "collected" || parsed.simulatedStatus === "collected") {
            setActiveOrder(null);
            return;
          }

          // If elapsed time is greater than 5 minutes (300 seconds), it's considered collected/completed
          const elapsed = Date.now() - new Date(parsed.placedAt).getTime();
          if (elapsed >= 300000 && !parsed.simulatedStatus) {
            setActiveOrder(null);
            return;
          }
          
          setActiveOrder(parsed);
        } else {
          setActiveOrder(null);
        }
      } catch {
        setActiveOrder(null);
      }
    };

    checkActiveOrder();
    const interval = setInterval(checkActiveOrder, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      setIsProfileOpen(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

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
            className={`navbar-nav-item ${location.pathname === "/orders" || location.pathname.startsWith("/order-tracking") ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              <span className={`material-symbols-outlined ${location.pathname === "/orders" || location.pathname.startsWith("/order-tracking") ? "icon-fill" : ""}`}>room_service</span>
              {itemCount > 0 && (
                <span className="cart-badge-indicator">{itemCount}</span>
              )}
            </span>
            Tray
          </Link>
          <Link 
            to="/wallet" 
            className={`navbar-nav-item ${location.pathname === "/wallet" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span className={`material-symbols-outlined ${location.pathname === "/wallet" ? "icon-fill" : ""}`}>account_balance_wallet</span>
            Wallet
          </Link>
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
            onClick={() => setIsProfileOpen(true)}
          >
            <img 
              alt="User profile avatar" 
              className="navbar-profile-avatar"
              src={avatarUrl}
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
      {/* Floating Order Tracking button on Home Screen */}
      {isMenuPage && activeOrder && (
        <Link 
          to="/order-tracking" 
          className="floating-order-btn" 
          aria-label="Track Order"
        >
          <span className="material-symbols-outlined">restaurant</span>
          <span className="floating-btn-pulse"></span>
        </Link>
      )}

      {/* Profile Sidebar Modal Overlay */}
      <div 
        className={`profile-sidebar-overlay ${isProfileOpen ? "open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsProfileOpen(false);
        }}
      >
        <aside className="profile-sidebar">
          {/* Sidebar Header */}
          <div className="profile-sidebar-header">
            <h2 className="profile-sidebar-title">My Profile</h2>
            <button 
              className="profile-sidebar-close" 
              onClick={() => setIsProfileOpen(false)}
              aria-label="Close profile sidebar"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="profile-sidebar-content">
            {/* Avatar Section */}
            <div className="profile-avatar-section">
              <div className="profile-avatar-container">
                <img 
                  alt="User profile avatar" 
                  className="profile-avatar-img" 
                  src={avatarUrl}
                />
              </div>
              <h3 className="profile-name-title">
                {profile?.full_name || user?.user_metadata?.full_name || "Student"}
              </h3>
            </div>

            {/* Student Information */}
            <div className="profile-info-section">
              <h4 className="profile-section-heading">
                <span className="material-symbols-outlined">badge</span> Student Information
              </h4>
              <div className="profile-info-list">
                {/* Full Name */}
                <div className="profile-info-item">
                  <div className="profile-info-icon-wrapper">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <div className="profile-info-content">
                    <p className="profile-info-label">Full Name</p>
                    <p className={`profile-info-value ${!(profile?.full_name || user?.user_metadata?.full_name) ? "fallback" : ""}`}>
                      {profile?.full_name || user?.user_metadata?.full_name || "Name unavailable"}
                    </p>
                  </div>
                </div>

                {/* Student ID */}
                <div className="profile-info-item">
                  <div className="profile-info-icon-wrapper">
                    <span className="material-symbols-outlined">id_card</span>
                  </div>
                  <div className="profile-info-content">
                    <p className="profile-info-label">Student ID</p>
                    <p className={`profile-info-value ${!profile?.student_number ? "fallback" : ""}`}>
                      {profile?.student_number || "Student ID unavailable"}
                    </p>
                  </div>
                </div>

                {/* University Email */}
                <div className="profile-info-item">
                  <div className="profile-info-icon-wrapper">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <div className="profile-info-content">
                    <p className="profile-info-label">University Email</p>
                    <p className={`profile-info-value ${!user?.email ? "fallback" : ""}`}>
                      {user?.email || "Email unavailable"}
                    </p>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="profile-info-item">
                  <div className="profile-info-icon-wrapper">
                    <span className="material-symbols-outlined">call</span>
                  </div>
                  <div className="profile-info-content">
                    <p className="profile-info-label">Phone Number</p>
                    <p className={`profile-info-value ${!(profile?.phone_number || user?.user_metadata?.phone_number) ? "fallback" : ""}`}>
                      {profile?.phone_number || user?.user_metadata?.phone_number || "Phone number not provided"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Links */}
            <div className="profile-actions-section">
              <button 
                className="profile-action-btn" 
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate("/profile/edit");
                }}
              >
                <div className="profile-action-btn-left">
                  <span className="material-symbols-outlined">settings</span>
                  <span>Edit account details</span>
                </div>
                <span className="material-symbols-outlined chevron-icon">chevron_right</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="profile-sidebar-footer">
            <button className="profile-logout-btn" onClick={handleLogout}>
              <span className="material-symbols-outlined">logout</span> Log Out
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AuthLayout;
