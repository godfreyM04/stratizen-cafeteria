import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setEmail("");
    setPassword("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (activeTab === "student" && email === "chef1@gmail.com") {
      setError("Please use the Chef login tab.");
      return;
    }

    if (activeTab === "chef" && email !== "chef1@gmail.com") {
      setError("This account is not registered as a chef account.");
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      if (activeTab === "chef") {
        navigate("/chef/dashboard");
      } else {
        navigate("/menu");
      }
    } catch (err) {
      console.error("Login component error:", err);
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Background Image overlay */}
      <div className="login-bg-image"></div>

      {/* Admin button in top-right corner */}
      <button 
        className="login-admin-button" 
        type="button" 
        onClick={() => navigate("/admin/login")}
      >
        Admin
      </button>

      <main className="login-wrapper">
        {/* Branding Section */}
        <div className="login-branding">
          <div className="login-logo-circle">
            <span className="material-symbols-outlined fill-icon">restaurant</span>
          </div>
          <h1 className="login-app-title">Stratizen Dining</h1>
          <p className="login-app-subtitle">University Food & Culinary Management System</p>
        </div>

        {/* Login Card */}
        <div className="login-card glass-effect">
          
          {/* Segmented Toggle Slider */}
          <div className="login-toggle-container">
            <div 
              className="login-toggle-slide" 
              style={{ left: activeTab === "student" ? "4px" : "calc(50% - 4px)" }}
            ></div>
            <button 
              className={`login-toggle-button ${activeTab === "student" ? "active" : ""}`}
              type="button"
              onClick={() => handleTabChange("student")}
            >
              Student
            </button>
            <button 
              className={`login-toggle-button ${activeTab === "chef" ? "active" : ""}`}
              type="button"
              onClick={() => handleTabChange("chef")}
            >
              Chef
            </button>
          </div>

          {/* Forms Container */}
          <div className="login-form-container">
            {error && <div className="error-banner">{error}</div>}

            {activeTab === "student" ? (
              /* Student Form View */
              <div className="login-form-view">
                <h2 className="login-welcome-title">Welcome back, Student</h2>
                <p className="login-welcome-subtitle">
                  Access your meal plans, digital wallet, and pre-order from your favorite campus kitchens.
                </p>

                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="input-label" htmlFor="student-email">Student Email</label>
                    <div className="input-relative">
                      <div className="input-icon-container">
                        <span className="material-symbols-outlined">mail</span>
                      </div>
                      <input 
                        className="form-input" 
                        id="student-email"
                        placeholder="student@strathmore.edu" 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="input-label" htmlFor="student-password">Password</label>
                    <div className="input-relative">
                      <div className="input-icon-container">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <input 
                        className="form-input" 
                        id="student-password"
                        placeholder="••••••••" 
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-options-row">
                    <label className="checkbox-container">
                      <input 
                        className="form-checkbox" 
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={loading}
                      />
                      <span className="checkbox-label">Remember Me</span>
                    </label>
                    <a className="forgot-password-link" href="#" onClick={(e) => { e.preventDefault(); alert("Password reset functionality placeholder"); }}>Forgot?</a>
                  </div>

                  <button 
                    className="submit-button"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "Login as Student"}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </form>

                <div className="form-footer">
                  <p className="form-footer-text">
                    New to Stratizen Cafeteria? 
                    <Link className="form-footer-link" to="/register">
                      Sign Up
                    </Link>
                  </p>
                </div>
              </div>
            ) : (
              /* Chef Form View */
              <div className="login-form-view">
                <h2 className="login-welcome-title">Kitchen Staff Login</h2>
                <p className="login-welcome-subtitle">
                  Enter your credentials to manage kitchen queues and menu inventory.
                </p>

                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="input-label" htmlFor="chef-email">Chef Email</label>
                    <div className="input-relative">
                      <div className="input-icon-container">
                        <span className="material-symbols-outlined">mail</span>
                      </div>
                      <input 
                        className="form-input" 
                        id="chef-email"
                        placeholder="chef.name@stratizen.edu" 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="input-label" htmlFor="chef-password">Password</label>
                    <div className="input-relative">
                      <div className="input-icon-container">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <input 
                        className="form-input" 
                        id="chef-password"
                        placeholder="••••••••" 
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-options-row">
                    <label className="checkbox-container">
                      <input 
                        className="form-checkbox" 
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={loading}
                      />
                      <span className="checkbox-label">Keep me signed in</span>
                    </label>
                    <a className="forgot-password-link" href="#" onClick={(e) => { e.preventDefault(); alert("Password reset functionality placeholder"); }}>Forgot?</a>
                  </div>

                  <button 
                    className="submit-button"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "Login as Staff"}
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer Links */}
        <footer className="login-footer">
          <a className="footer-link" href="#">
            <span className="material-symbols-outlined">help</span>
            Help Center
          </a>
          <div className="footer-divider-dot"></div>
          <a className="footer-link" href="#">
            <span className="material-symbols-outlined">policy</span>
            Privacy Policy
          </a>
        </footer>
      </main>
    </div>
  );
}

export default Login;