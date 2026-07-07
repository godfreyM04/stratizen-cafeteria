import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRole = "student" }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center-spinner" style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#fcf9f8",
        fontFamily: "'Inter', sans-serif"
      }}>
        <div className="spinner" style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "4px solid #eae7e7",
          borderTopColor: "#003366",
          animation: "spin 1s linear infinite"
        }}></div>
        <p style={{
          marginTop: "16px",
          color: "#43474f",
          fontSize: "16px",
          fontWeight: "500"
        }}>Verifying session...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isChef = profile?.role === "chef" || user.email === "chef1@gmail.com";
  const isAdmin = profile?.role === "admin" || user.email === "admin@gmail.com";

  if (allowedRole === "admin" && !isAdmin) {
    if (isChef) return <Navigate to="/chef/dashboard" replace />;
    return <Navigate to="/admin/login" replace />;
  }

  if (allowedRole === "chef" && !isChef) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/menu" replace />;
  }

  if (allowedRole === "student") {
    if (isChef) return <Navigate to="/chef/dashboard" replace />;
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
