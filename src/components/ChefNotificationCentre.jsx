import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ChefNotificationCentre() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [unreadCount, setUnreadCount] = useState(0);

  const calculateUnreadCount = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .eq("status", "pending");

      if (error) throw error;

      let readIds = [];
      if (profile?.id) {
        const stored = localStorage.getItem(`chef_read_notifications_${profile.id}`);
        if (stored) {
          try {
            readIds = JSON.parse(stored);
          } catch (e) {
            console.error("Failed to parse read notifications from localStorage");
          }
        }
      }

      const pendingIds = data.map(o => o.id);
      const unread = pendingIds.filter(id => !readIds.includes(id)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Failed to load notifications count:", err.message);
    }
  };

  useEffect(() => {
    calculateUnreadCount();

    const orderSubscription = supabase
      .channel("chef_notifications_badge_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          calculateUnreadCount();
        }
      )
      .subscribe();

    // Polling is removed to prevent unnecessary backend requests as per requirement #6
    // LocalStorage changes won't trigger re-renders across tabs directly without a listener,
    // so we can optionally listen to storage events to keep the badge synced.
    const handleStorageChange = (e) => {
      if (e.key === `chef_read_notifications_${profile?.id}`) {
        calculateUnreadCount();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      orderSubscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [profile?.id]);

  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <div className="relative cursor-pointer" onClick={() => navigate("/chef/notifications")}>
      <span className="material-symbols-outlined text-primary text-[28px]">notifications</span>
      {unreadCount > 0 && (
        <span className="absolute top-0 -right-1 min-w-[18px] h-[18px] px-1 bg-error rounded-full border-2 border-white text-white text-[10px] font-bold flex items-center justify-center leading-none z-10" style={{ transform: 'translate(25%, -25%)' }}>
          {displayCount}
        </span>
      )}
    </div>
  );
}
