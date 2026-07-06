import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ChefLogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <button 
      className="w-full text-left flex items-center gap-md text-error px-md py-sm hover:bg-error-container/20 rounded-lg transition-all border-none bg-transparent cursor-pointer" 
      type="button" 
      onClick={handleLogout}
    >
      <span className="material-symbols-outlined text-error">logout</span>
      <span className="font-label-lg text-label-lg text-error">Logout</span>
    </button>
  );
}
