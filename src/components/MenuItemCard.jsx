import React from "react";
import { useNavigate } from "react-router-dom";
import { useTray } from "../context/TrayContext";
import { useToast } from "../context/ToastContext";
import QuantityCounter from "./QuantityCounter";

const formatKES = (price) => {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MenuItemCard = ({ item }) => {
  const navigate = useNavigate();
  const { trayItems, addToTray } = useTray();
  const { addToast } = useToast();

  const handleCardClick = () => {
    navigate(`/food/${item.id}`);
  };

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToTray(item, 1);
    addToast(`Added the ${item.name} to the tray`);
  };

  const isAvailable = item.availability === "Available" || item.availability === true;
  const availabilityText = typeof item.availability === "boolean" 
    ? (item.availability ? "Available" : "Unavailable") 
    : (item.availability || "Available");
  const trayItem = trayItems.find((i) => i.id === item.id);

  return (
    <article className="menu-item-card" onClick={handleCardClick}>
      <div className="card-image-wrapper">
        <img src={item.image_url || item.image} alt={item.name} className="card-food-image" />
        <span className={`availability-tag ${isAvailable ? "available" : "limited"}`}>
          <span className="material-symbols-outlined tag-icon">
            {isAvailable ? "check_circle" : "warning"}
          </span>
          {availabilityText}
        </span>
      </div>
      <div className="card-details">
        <h3 className="card-title">{item.name}</h3>
        <p className="card-description">{item.description}</p>
        <div className="card-footer-row">
          <span className="card-price">KES {formatKES(item.price)}</span>
          {trayItem ? (
            <QuantityCounter itemId={item.id} />
          ) : (
            <button className="card-add-button" onClick={handleAddToCart}>
              <span className="material-symbols-outlined button-cart-icon">add_shopping_cart</span>
              Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default MenuItemCard;
