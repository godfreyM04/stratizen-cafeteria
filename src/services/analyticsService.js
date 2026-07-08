import { supabase } from "../lib/supabase";

/**
 * analyticsService.js
 * 
 * Centralized fetch functions for analytics data.
 * Reused across Chef and Administrator modules to avoid duplication.
 */

export const fetchCompletedOrders = async (role) => {
  try {
    if (role === "admin") {
      // Fetch via security-definer RPCs for admin to bypass RLS
      const { data: ordersData, error: ordersError } = await supabase
        .rpc("admin_get_all_orders");
      if (ordersError) throw ordersError;

      const { data: itemsData, error: itemsError } = await supabase
        .rpc("admin_get_all_order_items");
      if (itemsError) throw itemsError;

      // Group items by order_id
      const itemsMap = {};
      (itemsData || []).forEach(item => {
        if (!itemsMap[item.order_id]) {
          itemsMap[item.order_id] = [];
        }
        itemsMap[item.order_id].push({
          quantity: item.quantity,
          menu: {
            id: item.menu_item_id,
            name: item.menu_name || "Meal",
            image_url: item.menu_image_url || null
          }
        });
      });

      // Filter collected and map to match standard schema format
      return (ordersData || [])
        .filter(o => o.status === "collected")
        .map(o => ({
          ...o,
          order_items: itemsMap[o.id] || []
        }));
    } else {
      // Standard query for chef
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, menu(*))")
        .eq("status", "collected")
        .order("collected_at", { ascending: false });

      if (error) throw error;
      return data || [];
    }
  } catch (err) {
    console.error(`[AnalyticsService] Failed to fetch completed orders for role ${role}:`, err.message);
    throw err;
  }
};
