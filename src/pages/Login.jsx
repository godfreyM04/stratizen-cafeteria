import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/menu");
    } catch (err) {
      console.error("Login component error:", err);
      if (err.message && err.message.toLowerCase().includes("email not confirmed")) {
        setError("Your email address has not been confirmed yet. Please check your inbox for a confirmation link, or disable 'Confirm email' in your Supabase project (Authentication -> Providers -> Email).");
      } else {
        setError(err.message || "Failed to sign in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Right Side: Login Form */}
      <div className="login-form-side">
        <div className="login-form-card">
          <div className="login-header-block">
            <div className="login-logo-circle">
              <span className="material-symbols-outlined fill-icon">school</span>
            </div>
            <h1 className="login-app-title">Stratizen Cafeteria</h1>
          </div>

          <div className="login-welcome-block">
            <h2 className="login-welcome-title">Welcome Back</h2>
            <p className="login-welcome-subtitle">Sign in to manage your orders and wallet.</p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="input-label" htmlFor="email">Student Email</label>
              <div className="input-relative">
                <div className="input-icon-container">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <input
                  className="form-input"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="student@strathmore.edu"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="password">Password</label>
              <div className="input-relative">
                <div className="input-icon-container">
                  <span className="material-symbols-outlined">lock</span>
                </div>
                <input
                  className="form-input"
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-options-row">
              <div className="checkbox-container">
                <input
                  className="form-checkbox"
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <label className="checkbox-label" htmlFor="remember-me">
                  Remember Me
                </label>
              </div>
              <div className="text-sm">
                <a className="forgot-password-link" href="#" onClick={(e) => { e.preventDefault(); alert("Password reset functionality placeholder"); }}>
                  Forgot Password?
                </a>
              </div>
            </div>

            <div className="submit-button-container">
              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </div>
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
      </div>
    </div>
  );
}

export default Login;