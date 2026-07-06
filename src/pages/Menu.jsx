import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import MenuItemCard from "../components/MenuItemCard";
import AuthLayout from "../components/AuthLayout";
import "../styles/Menu.css";

function Menu() {
  const { user, profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Match the seeded categories from the database schema
  const categories = ["All", "Breakfast", "Lunch", "Dinner", "Sides", "Beverages"];

  const fetchMenu = async () => {
    try {
      console.log("[Menu] Fetching live menu items from Supabase...");
      const { data, error } = await supabase
        .from("menu")
        .select("*")
        .eq("availability", true)
        .order("name", { ascending: true });

      if (error) throw error;
      
      // Map database schema columns to frontend MenuItem card expectations
      const mapped = (data || []).map(item => ({
        id: item.id, // Database UUID
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        image: item.image_url,
        image_url: item.image_url,
        category: item.category,
        availability: "Available"
      }));
      setMenuItems(mapped);
    } catch (err) {
      console.error("[Menu] Failed to fetch menu items from Supabase:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Subscribe to real-time changes in the menu table
    const menuSubscription = supabase
      .channel("student_menu_sync_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu" },
        (payload) => {
          console.log("[Menu] Real-time menu change received, re-fetching:", payload);
          fetchMenu();
        }
      )
      .subscribe();

    return () => {
      menuSubscription.unsubscribe();
    };
  }, []);

  // Filter items based on active category and search query
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || 
      item.category?.toLowerCase() === activeCategory?.toLowerCase();
    
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const studentName = profile?.full_name || user?.email?.split("@")[0] || "Student";

  return (
    <AuthLayout onSearchChange={setSearchQuery}>
      {/* Welcome & Filter Area */}
      <section className="menu-welcome-section">
        <div className="welcome-info">
          <h1 className="welcome-title">Welcome back, {studentName}!</h1>
          <p className="welcome-subtitle">Explore Menu</p>
        </div>
        <div className="category-filters-container">
          {categories.map((category) => (
            <button
              key={category}
              className={`filter-chip ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Menu Grid */}
      <section className="menu-grid-section">
        {loading ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 0", color: "var(--color-on-surface-variant)" }}>
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: "48px", marginBottom: "8px" }}>sync</span>
            <p>Loading menu items...</p>
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))
        ) : (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 0", color: "var(--color-on-surface-variant)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", marginBottom: "8px" }}>search_off</span>
            <p>No food items found matching your filters.</p>
          </div>
        )}
      </section>
    </AuthLayout>
  );
}

export default Menu;
