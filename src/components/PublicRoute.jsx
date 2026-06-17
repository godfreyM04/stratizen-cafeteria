import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

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
        }}>Loading...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/menu" replace />;
  }

  return children ? children : <Outlet />;
};

export default PublicRoute;
