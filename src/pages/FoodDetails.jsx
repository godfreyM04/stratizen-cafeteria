import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useTray } from "../context/TrayContext";
import { useToast } from "../context/ToastContext";
import AuthLayout from "../components/AuthLayout";
import QuantityCounter from "../components/QuantityCounter";
import "../styles/FoodDetails.css";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function FoodDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trayItems, addToTray } = useTray();
  const { addToast } = useToast();

  const [item, setItem] = useState(null);
  const [relatedItems, setRelatedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const fetchItemDetails = async () => {
      setLoading(true);
      try {
        console.log(`[FoodDetails] Fetching details for item: ${id}`);
        // 1. Fetch the main menu item
        const { data: dbItem, error: fetchError } = await supabase
          .from("menu")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;

        if (dbItem) {
          const mappedItem = {
            id: dbItem.id,
            name: dbItem.name,
            description: dbItem.description,
            price: parseFloat(dbItem.price),
            image: dbItem.image_url,
            image_url: dbItem.image_url,
            category: dbItem.category,
            availability: dbItem.availability ? "Available" : "Limited"
          };
          setItem(mappedItem);

          // 2. Fetch related items in same category, up to 4 items
          const { data: dbRelated, error: relatedError } = await supabase
            .from("menu")
            .select("*")
            .eq("category", dbItem.category)
            .neq("id", dbItem.id)
            .limit(4);

          if (relatedError) throw relatedError;

          let mappedRelated = (dbRelated || []).map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            price: parseFloat(r.price),
            image: r.image_url,
            image_url: r.image_url,
            category: r.category,
            availability: r.availability ? "Available" : "Limited"
          }));

          // 3. Fallback: If less than 4 related items, add some other items
          if (mappedRelated.length < 4) {
            const excludeIds = [dbItem.id, ...mappedRelated.map(r => r.id)];
            const { data: dbFallbacks } = await supabase
              .from("menu")
              .select("*")
              .not("id", "in", `(${excludeIds.join(",")})`)
              .limit(4 - mappedRelated.length);

            if (dbFallbacks) {
              const mappedFallbacks = dbFallbacks.map(f => ({
                id: f.id,
                name: f.name,
                description: f.description,
                price: parseFloat(f.price),
                image: f.image_url,
                image_url: f.image_url,
                category: f.category,
                availability: f.availability ? "Available" : "Limited"
              }));
              mappedRelated = [...mappedRelated, ...mappedFallbacks];
            }
          }

          setRelatedItems(mappedRelated);
        } else {
          setItem(null);
        }
      } catch (err) {
        console.error("[FoodDetails] Failed to fetch item details:", err.message);
        setItem(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchItemDetails();
    }
  }, [id]);

  const trayItem = item ? trayItems.find((i) => i.id === item.id) : null;

  if (loading) {
    return (
      <AuthLayout>
        <div style={{ textAlign: "center", padding: "80px 16px", fontFamily: "var(--font-family)" }}>
          <span className="material-symbols-outlined animate-spin" style={{ fontSize: "64px", color: "var(--color-primary)", marginBottom: "16px" }}>sync</span>
          <h2 style={{ fontSize: "20px", color: "var(--color-on-surface)", marginBottom: "8px" }}>Loading details...</h2>
        </div>
      </AuthLayout>
    );
  }

  if (!item) {
    return (
      <AuthLayout>
        <div style={{ textAlign: "center", padding: "80px 16px", fontFamily: "var(--font-family)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "var(--color-outline)", marginBottom: "16px" }}>question_mark</span>
          <h2 style={{ fontSize: "28px", color: "var(--color-primary)", marginBottom: "8px" }}>Food Item Not Found</h2>
          <p style={{ color: "var(--color-on-surface-variant)", marginBottom: "24px" }}>The item you are looking for does not exist or has been removed.</p>
          <button className="back-button" style={{ margin: "0 auto" }} onClick={() => navigate("/menu")}>
            <span className="material-symbols-outlined back-icon">arrow_back</span>
            Back to Menu
          </button>
        </div>
      </AuthLayout>
    );
  }

  const handleAddToTray = () => {
    addToTray(item, 1);
    addToast(`Added the ${item.name} to the tray`);
  };

  const handleRelatedClick = (relatedId) => {
    navigate(`/food/${relatedId}`);
  };

  const handleRelatedAdd = (e, relatedItem) => {
    e.stopPropagation();
    addToTray(relatedItem, 1);
    addToast(`Added the ${relatedItem.name} to the tray`);
  };

  return (
    <AuthLayout>
      {/* Back Button */}
      <div className="back-button-container">
        <button className="back-button" onClick={() => navigate("/menu")}>
          <span className="material-symbols-outlined back-icon">arrow_back</span>
          <span>Back to Menu</span>
        </button>
      </div>

      {/* Main Detail Section */}
      <section className="product-detail-grid">
        {/* Hero Image Card */}
        <div className="product-image-card">
          <img src={item.image_url || item.image} alt={item.name} className="product-hero-image" />
          <span className="category-badge-absolute">{item.category}</span>
        </div>

        {/* Info Card */}
        <div className="product-info-card">
          <div className="product-title-price">
            <h1 className="product-title">{item.name}</h1>
            <p className="product-price">KES {formatKES(item.price)}</p>
          </div>

          <div className="product-description-block">
            <h3 className="section-label">Description</h3>
            <p className="product-description-text">{item.description}</p>
          </div>

          <div className="product-actions-row">
            {trayItem ? (
              <QuantityCounter itemId={item.id} />
            ) : (
              <button className="add-tray-btn" onClick={handleAddToTray}>
                <span className="material-symbols-outlined">shopping_cart</span>
                Add to Tray
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Related Items Section */}
      {relatedItems.length > 0 && (
        <section className="related-items-container">
          <div className="related-header-row">
            <div className="related-title-block">
              <h2 className="related-title">Related Items</h2>
              <p className="related-subtitle">Complete your meal with these campus favorites.</p>
            </div>
            <button className="related-view-all" onClick={() => navigate("/menu")}>
              View All {item.category}
            </button>
          </div>

          <div className="related-items-grid">
            {relatedItems.map((related) => (
              <div
                key={related.id}
                className="related-item-card"
                onClick={() => handleRelatedClick(related.id)}
              >
                <div className="related-card-image-wrapper">
                  <img
                    src={related.image_url || related.image}
                    alt={related.name}
                    className="related-card-image"
                  />
                </div>
                <div className="related-card-details">
                  <p className="related-card-category">{related.category}</p>
                  <h4 className="related-card-title">{related.name}</h4>
                  <div className="related-card-footer">
                    <span className="related-card-price">KES {formatKES(related.price)}</span>
                    <button
                      className="related-card-add-btn"
                      onClick={(e) => handleRelatedAdd(e, related)}
                      aria-label="add related to tray"
                    >
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AuthLayout>
  );
}

export default FoodDetails;
