import { supabase } from "../lib/supabase";

let cachedMenu = null;

export const fetchMenu = async (forceRefresh = false) => {
  if (cachedMenu && !forceRefresh) {
    return cachedMenu;
  }

  try {
    const { data, error } = await supabase
      .from("menu")
      .select("*")
      .eq("availability", true)
      .order("name", { ascending: true });

    if (error) throw error;

    // Map database fields to frontend props
    cachedMenu = (data || []).map(item => ({
      ...item,
      image: item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
      availability: item.availability ? "Available" : "Out of Stock"
    }));

    return cachedMenu;
  } catch (err) {
    console.error("Failed to fetch menu from Supabase:", err.message);
    // Return empty list on failure
    return [];
  }
};

export const fetchMenuItem = async (id) => {
  // If cache exists, find in cache
  if (cachedMenu) {
    const found = cachedMenu.find(item => item.id === id || item.id.toString() === id.toString());
    if (found) return found;
  }

  try {
    const { data, error } = await supabase
      .from("menu")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      image: data.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
      availability: data.availability ? "Available" : "Out of Stock"
    };
  } catch (err) {
    console.error(`Failed to fetch menu item ${id}:`, err.message);
    return null;
  }
};

// Fetch all menu items (including unavailable ones) for the Chef Menu Manager
export const fetchAllMenuItems = async () => {
  try {
    const { data, error } = await supabase
      .from("menu")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      ...item,
      image: item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
      availability: item.availability
    }));
  } catch (err) {
    console.error("Failed to fetch all menu items from Supabase:", err.message);
    return [];
  }
};

// Create a new menu item
export const createMenuItem = async (itemData) => {
  try {
    const { data, error } = await supabase
      .from("menu")
      .insert([
        {
          name: itemData.name,
          category: itemData.category,
          description: itemData.description,
          price: parseFloat(itemData.price),
          image_url: itemData.image_url,
          availability: itemData.availability
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Clear cache
    cachedMenu = null;
    return { success: true, data };
  } catch (err) {
    console.error("Failed to create menu item:", err.message);
    throw err;
  }
};

// Update an existing menu item
export const updateMenuItem = async (id, itemData) => {
  try {
    const { data, error } = await supabase
      .from("menu")
      .update({
        name: itemData.name,
        category: itemData.category,
        description: itemData.description,
        price: parseFloat(itemData.price),
        image_url: itemData.image_url,
        availability: itemData.availability,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Clear cache
    cachedMenu = null;
    return { success: true, data };
  } catch (err) {
    console.error(`Failed to update menu item ${id}:`, err.message);
    throw err;
  }
};

// Check if menu item is referenced in historical orders
export const checkItemReferences = async (id) => {
  try {
    const { count, error } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("menu_item_id", id);

    if (error) throw error;
    return count > 0;
  } catch (err) {
    console.error(`Failed to check references for item ${id}:`, err.message);
    // If check fails, default to true to be safe (prevent hard deletion)
    return true;
  }
};

// Delete or archive menu item
export const deleteMenuItem = async (id) => {
  try {
    const hasReferences = await checkItemReferences(id);
    
    if (hasReferences) {
      // Soft-delete / Archive by setting availability to false
      const { data, error } = await supabase
        .from("menu")
        .update({
          availability: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      
      cachedMenu = null;
      return { success: true, type: "archive", data };
    } else {
      // Hard delete
      const { error } = await supabase
        .from("menu")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      cachedMenu = null;
      return { success: true, type: "delete" };
    }
  } catch (err) {
    console.error(`Failed to delete menu item ${id}:`, err.message);
    throw err;
  }
};

