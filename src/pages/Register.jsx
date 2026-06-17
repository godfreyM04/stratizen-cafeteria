import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Register.css";

function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Password confirmation check
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const data = await signUp(email, password, fullName, studentId, phoneNumber);
      
      // If email confirmation is enabled, session won't be active immediately
      if (data && !data.session) {
        alert(`Account created successfully! A confirmation link has been sent to ${email}. Please confirm your email address before logging in.`);
        navigate("/login");
      } else {
        navigate("/menu");
      }
    } catch (err) {
      console.error("Register component error:", err);
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-container">
      <div className="register-form-side">
        <div className="register-form-card">
          <div className="register-header-block">
            <div className="register-logo-circle">
              <span className="material-symbols-outlined fill-icon">school</span>
            </div>
            <h1 className="register-app-title">Stratizen Cafeteria</h1>
          </div>

          <div className="register-welcome-block">
            <h2 className="register-welcome-title">Create an Account</h2>
            <p className="register-welcome-subtitle">Enter your details to register as a student.</p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {/* Registration Form */}
          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="input-label" htmlFor="student_id">Student ID</label>
              <div className="input-relative">
                <div className="input-icon-container">
                  <span className="material-symbols-outlined">badge</span>
                </div>
                <input
                  className="form-input"
                  id="student_id"
                  name="student_id"
                  type="text"
                  placeholder="Student ID"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="full_name">Full Name</label>
              <div className="input-relative">
                <div className="input-icon-container">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <input
                  className="form-input"
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Full Name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="university_email">University Email</label>
              <div className="input-relative">
                <div className="input-icon-container">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <input
                  className="form-input"
                  id="university_email"
                  name="university_email"
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
              <label className="input-label" htmlFor="phone_number">Phone Number</label>
              <div className="input-relative">
                <div className="input-icon-container">
                  <span className="material-symbols-outlined">phone</span>
                </div>
                <input
                  className="form-input"
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  placeholder="Phone Number"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="password-grid">
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

              <div className="form-group">
                <label className="input-label" htmlFor="confirm_password">Confirm Password</label>
                <div className="input-relative">
                  <div className="input-icon-container">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <input
                    className="form-input"
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="submit-button-container">
              <button className="submit-button" type="submit" disabled={loading}>
                <span>{loading ? "Registering..." : "Register"}</span>
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_forward</span>
              </button>
            </div>
          </form>

          <div className="form-footer">
            <p className="form-footer-text">
              Already have an account?
              <Link className="form-footer-link" to="/login">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;