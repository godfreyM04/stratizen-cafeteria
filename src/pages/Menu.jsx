import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { mockMenuItems } from "../data/mockMenu";
import MenuItemCard from "../components/MenuItemCard";
import AuthLayout from "../components/AuthLayout";
import "../styles/Menu.css";

function Menu() {
  const { user, profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["All", "Breakfast", "Lunch", "Dinner", "Snacks", "Drinks"];

  // Filter items based on active category and search query
  const filteredItems = mockMenuItems.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
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
        {filteredItems.length > 0 ? (
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
