import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const TrayContext = createContext(null);

export const TrayProvider = ({ children }) => {
  const [trayItems, setTrayItems] = useState(() => {
    try {
      const stored = localStorage.getItem("stratizen_tray");
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error("Failed to parse stored tray data:", err);
      return [];
    }
  });

  // Sync tray items to localStorage when they change
  useEffect(() => {
    localStorage.setItem("stratizen_tray", JSON.stringify(trayItems));
  }, [trayItems]);

  // Add item to tray
  const addToTray = useCallback((item, quantity = 1) => {
    setTrayItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((i) => i.id === item.id);
      if (existingItemIndex > -1) {
        // Increment quantity of existing item
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity,
        };
        return updatedItems;
      } else {
        // Add new item to tray
        return [
          ...prevItems,
          {
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            category: item.category,
            description: item.description,
            quantity: quantity,
          },
        ];
      }
    });
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((itemId, quantity) => {
    if (quantity <= 0) {
      setTrayItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      return;
    }
    setTrayItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  }, []);

  // Remove item from tray
  const removeFromTray = useCallback((itemId) => {
    setTrayItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
  }, []);

  // Clear all items in tray
  const clearTray = useCallback(() => {
    setTrayItems([]);
  }, []);

  // Computed state properties
  const itemCount = useMemo(() => trayItems.reduce((total, item) => total + item.quantity, 0), [trayItems]);
  const subtotal = useMemo(() => trayItems.reduce((total, item) => total + item.price * item.quantity, 0), [trayItems]);
  const tax = useMemo(() => subtotal * 0.08, [subtotal]); // 8% Tax
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const value = useMemo(() => ({
    trayItems,
    itemCount,
    subtotal,
    tax,
    total,
    addToTray,
    updateQuantity,
    removeFromTray,
    clearTray,
  }), [
    trayItems,
    itemCount,
    subtotal,
    tax,
    total,
    addToTray,
    updateQuantity,
    removeFromTray,
    clearTray
  ]);

  return <TrayContext.Provider value={value}>{children}</TrayContext.Provider>;
};

export const useTray = () => {
  const context = useContext(TrayContext);
  if (!context) {
    throw new Error("useTray must be used within a TrayProvider");
  }
  return context;
};
