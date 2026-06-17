import React from "react";
import { useTray } from "../context/TrayContext";
import { useToast } from "../context/ToastContext";

const QuantityCounter = ({ itemId }) => {
  const { trayItems, updateQuantity, removeFromTray } = useTray();
  const { addToast } = useToast();

  const trayItem = trayItems.find((i) => i.id === itemId);

  if (!trayItem) return null;

  const handleDecrement = (e) => {
    e.stopPropagation();
    if (trayItem.quantity === 1) {
      removeFromTray(itemId);
      // Optional: add a toast notification for removal, but wait, the prompt doesn't ask for a toast on delete. It says "Revert UI back to Add button". Let's keep it simple.
    } else {
      updateQuantity(itemId, trayItem.quantity - 1);
    }
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    updateQuantity(itemId, trayItem.quantity + 1);
  };

  return (
    <div className="quantity-counter-wrapper" onClick={(e) => e.stopPropagation()}>
      {trayItem.quantity === 1 ? (
        <button
          className="qty-counter-btn delete-btn"
          onClick={handleDecrement}
          aria-label="remove item"
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      ) : (
        <button
          className="qty-counter-btn"
          onClick={handleDecrement}
          aria-label="decrease quantity"
        >
          <span className="material-symbols-outlined">remove</span>
        </button>
      )}
      <span className="qty-counter-display">{trayItem.quantity}</span>
      <button
        className="qty-counter-btn"
        onClick={handleIncrement}
        aria-label="increase quantity"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
};

export default QuantityCounter;
