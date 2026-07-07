import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/AdminLogin.css";

function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (email !== "admin@gmail.com" || password !== "admin") {
        throw new Error("Invalid administrator credentials.");
      }
      await login(email, password);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Failed to authenticate as administrator.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="al-page-container">
      {/* Ambient Background Effects (Level 0 depth) */}
      <div className="al-ambient-glow al-glow-1"></div>
      <div className="al-ambient-glow al-glow-2"></div>

      {/* Login Card Container (Level 1 Elevation) */}
      <div className="al-login-card">
        {/* Header Section */}
        <div className="al-header">
          {/* Brand Icon */}
          <div className="al-logo-icon">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              admin_panel_settings
            </span>
          </div>
          <div className="al-title-container">
            <p className="al-brand-name">Stratizen Cafeteria</p>
            <h1 className="al-heading desktop">Administrator Portal</h1>
            <h1 className="al-heading mobile">Administrator Portal</h1>
            <p className="al-subtitle">Sign in with your executive credentials.</p>
          </div>
        </div>

        {/* Error Banner */}
        {error && <div className="al-error-banner">{error}</div>}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="al-form">
          {/* Email Input */}
          <div className="al-form-group">
            <label className="al-label" htmlFor="admin-email">
              Administrator Email
            </label>
            <div className="al-input-wrapper">
              <span className="material-symbols-outlined al-input-icon">mail</span>
              <input
                className="al-input"
                id="admin-email"
                type="email"
                placeholder="admin@stratizen.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="al-form-group">
            <label className="al-label" htmlFor="admin-password">
              Password
            </label>
            <div className="al-input-wrapper">
              <span className="material-symbols-outlined al-input-icon">lock</span>
              <input
                className="al-input"
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="al-actions-group">
            <button className="al-submit-btn" type="submit" disabled={loading}>
              <span>{loading ? "Signing in..." : "Login to Dashboard"}</span>
              <span className="material-symbols-outlined al-btn-arrow">arrow_forward</span>
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="al-divider"></div>

        {/* Secondary Action */}
        <button
          className="al-back-btn"
          type="button"
          onClick={() => navigate("/login")}
          disabled={loading}
        >
          <span className="material-symbols-outlined">switch_account</span>
          <span>Back to Student/Chef Login</span>
        </button>
      </div>
    </div>
  );
}

export default AdminLogin;
