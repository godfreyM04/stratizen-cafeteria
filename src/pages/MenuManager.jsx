import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { supabase } from "../lib/supabase";
import { 
  fetchAllMenuItems, 
  createMenuItem, 
  updateMenuItem, 
  deleteMenuItem,
  checkItemReferences 
} from "../services/menuService";
import ChefNotificationCentre from "../components/ChefNotificationCentre";
import ChefLogoutButton from "../components/ChefLogoutButton";
import "../styles/MenuManager.css";

function MenuManager() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  // State Variables
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: "",
    category: "Lunch",
    price: "",
    availability: true,
    description: "",
    image_url: ""
  });
  const [imagePreview, setImagePreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Categories aligned with Student Menu categories
  const categories = ["All", "Breakfast", "Lunch", "Dinner", "Sides", "Beverages"];
  const formCategories = ["Breakfast", "Lunch", "Dinner", "Sides", "Beverages"];

  // Load menu items from Supabase
  const loadMenu = async () => {
    try {
      const data = await fetchAllMenuItems();
      setMenuItems(data);
    } catch (err) {
      console.error("Failed to load menu items:", err.message);
      addToast("Failed to load menu items.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();

    // Subscribe to real-time changes on the menu table
    const menuSubscription = supabase
      .channel("menu_manager_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu" },
        (payload) => {
          console.log("Real-time menu update received on Chef Menu Manager:", payload);
          loadMenu();
        }
      )
      .subscribe();

    return () => {
      menuSubscription.unsubscribe();
    };
  }, []);

  // Form Validation: returns true if form is valid
  const isFormValid = () => {
    return (
      formData.name.trim() !== "" &&
      formData.category !== "" &&
      formData.price !== "" &&
      parseFloat(formData.price) > 0 &&
      formData.description.trim() !== "" &&
      (formData.image_url !== "" || imagePreview !== "")
    );
  };

  // Image upload and client-side canvas compression to Base64
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5242880) {
      addToast("Image size must be less than 5MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Downscale image to max 600px width/height to keep Base64 payload light
        const maxDimension = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.75 quality
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
        setImagePreview(compressedBase64);
        setFormData(prev => ({ ...prev, image_url: compressedBase64 }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Save (Create or Update) Menu Item
  const handleSave = async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSaving(true);
    try {
      if (isEditing) {
        await updateMenuItem(editingItemId, formData);
        addToast(`Successfully updated ${formData.name}`);
      } else {
        await createMenuItem(formData);
        addToast(`Successfully added ${formData.name}`);
      }
      closeModal();
      loadMenu();
    } catch (err) {
      console.error("Failed to save menu item:", err.message);
      addToast(err.message || "Failed to save menu item.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle item availability in database immediately
  const handleToggleAvailability = async (item) => {
    const updatedStatus = !item.availability;
    try {
      await updateMenuItem(item.id, {
        name: item.name,
        category: item.category,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
        availability: updatedStatus
      });
      addToast(`${item.name} is now ${updatedStatus ? "Available" : "Unavailable"}`);
      loadMenu();
    } catch (err) {
      console.error("Failed to toggle availability:", err.message);
      addToast("Failed to update availability.", "error");
    }
  };

  // Delete item with check for order references
  const handleDeleteItem = async (item) => {
    const hasRefs = await checkItemReferences(item.id);
    const confirmMessage = hasRefs
      ? `This item has been ordered in the past. Permanent deletion is not allowed. Would you like to Archive it (make it unavailable for future orders) instead?`
      : `Are you sure you want to permanently delete "${item.name}"? This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      try {
        const result = await deleteMenuItem(item.id);
        if (result.type === "archive") {
          addToast(`Archived "${item.name}" (set to unavailable)`);
        } else {
          addToast(`Deleted "${item.name}" permanently`);
        }
        loadMenu();
      } catch (err) {
        console.error("Failed to delete menu item:", err.message);
        addToast("Failed to delete item.", "error");
      }
    }
  };

  // Modal Controls
  const openAddModal = () => {
    setIsEditing(false);
    setEditingItemId(null);
    setFormData({
      name: "",
      category: "Lunch",
      price: "",
      availability: true,
      description: "",
      image_url: ""
    });
    setImagePreview("");
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditing(true);
    setEditingItemId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      availability: item.availability,
      description: item.description || "",
      image_url: item.image_url || ""
    });
    setImagePreview(item.image_url || "");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditingItemId(null);
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Filters logic
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory =
      activeCategory === "All" ||
      item.category?.toLowerCase() === activeCategory?.toLowerCase();

    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.price.toString().includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="menu-manager-container">
      {/* Sidebar Navigation */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant flex flex-col py-lg z-50">
        <div className="px-lg mb-xl">
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary-container w-8 h-8 flex items-center justify-center text-[32px]">restaurant</span>
            <h1 className="text-headline-lg text-primary font-bold leading-tight">Stratizen</h1>
          </div>
          <p className="text-label-md text-on-surface-variant opacity-70">Chef Management Portal</p>
        </div>
        
        <nav className="flex-grow px-md space-y-1">
          <button className="nav-item" onClick={() => navigate("/chef/dashboard")}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-label-lg font-medium">Kitchen Dashboard</span>
          </button>
          <button className="nav-item active-nav" onClick={() => navigate("/chef/menu")}>
            <span className="material-symbols-outlined">restaurant_menu</span>
            <span className="text-label-lg font-medium">Menu Manager</span>
          </button>
          <button className="nav-item" onClick={() => navigate("/chef/pending")}>
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="text-label-lg font-medium">Order Queue</span>
          </button>
          <button className="nav-item" onClick={() => navigate("/chef/monitor")}>
            <span className="material-symbols-outlined">soup_kitchen</span>
            <span className="text-label-lg font-medium">Kitchen Monitor</span>
          </button>
          <button className="nav-item" onClick={() => navigate("/chef/ready")}>
            <span className="material-symbols-outlined">storefront</span>
            <span className="text-label-lg font-medium">Ready to Collect</span>
          </button>
          <button className="nav-item" onClick={() => navigate("/chef/history")}>
            <span className="material-symbols-outlined">history</span>
            <span className="text-label-lg font-medium">Order History</span>
          </button>
        </nav>

        <div className="px-md mt-auto pt-lg border-t border-outline-variant/30 space-y-xs">
          <ChefLogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top App Bar */}
        <header className="sticky top-0 z-40 h-16 w-full px-lg bg-surface/80 backdrop-blur-md border-b border-outline-variant/20 flex items-center justify-between">
          <h2 className="text-headline-sm font-bold text-on-surface">Menu Manager</h2>
          <div className="flex items-center gap-lg">
            <div className="flex items-center gap-sm bg-surface-container-low px-md py-sm rounded-full border border-outline-variant/30 w-96">
              <span className="material-symbols-outlined text-on-surface-variant">search</span>
              <input 
                className="bg-transparent border-none w-full text-body-md placeholder:text-on-surface-variant/50" 
                placeholder="Search dish, category or price..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
             <div className="flex items-center gap-sm">
              <ChefNotificationCentre />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-lg space-y-lg max-w-7xl mx-auto w-full">
          {/* Filters Row */}
          <div className="flex justify-between items-center gap-md">
            <div className="flex gap-sm overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`border-none cursor-pointer px-lg py-sm rounded-full font-medium transition-all ${
                    activeCategory === cat 
                      ? "bg-primary text-on-primary shadow-sm" 
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === "All" ? "All Items" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Dishes */}
          {loading ? (
            <div className="flex-col items-center justify-center p-xl gap-sm text-center">
              <span className="material-symbols-outlined animate-spin text-primary text-[48px]">sync</span>
              <p className="text-body-md text-on-surface-variant">Loading menu inventory...</p>
            </div>
          ) : (
            <div className="menu-grid">
              {/* Add New Item Placeholder Card */}
              <div 
                className="border-2 border-dashed border-outline-variant/30 rounded-xl flex flex-col items-center justify-center p-lg gap-md hover:bg-surface-container-low transition-all cursor-pointer group min-h-[380px]"
                onClick={openAddModal}
              >
                <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary text-[32px]">add</span>
                </div>
                <div className="text-center">
                  <p className="text-title-lg font-bold text-on-surface">Add New Item</p>
                  <p className="text-body-md text-on-surface-variant">Create a new menu entry</p>
                </div>
              </div>

              {/* Loop Dishes */}
              {filteredMenuItems.map((item) => (
                <div 
                  key={item.id} 
                  className={`bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20 hover:shadow-xl transition-all group flex flex-col ${
                    !item.availability ? "opacity-75" : ""
                  }`}
                >
                  <div className="relative h-56 overflow-hidden bg-surface-container-low">
                    <img 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      src={item.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"} 
                    />
                    <div className="absolute top-4 left-4 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                      {item.category}
                    </div>
                    
                    {/* Unavailable Overlay */}
                    {!item.availability && (
                      <div className="absolute inset-0 bg-inverse-surface/40 flex items-center justify-center">
                        <span className="bg-white text-on-surface font-bold px-lg py-sm rounded-full shadow-lg text-label-lg">UNAVAILABLE</span>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t">
                      <span className="text-white font-bold text-lg">KES {parseFloat(item.price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button 
                      className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full text-error hover:bg-error hover:text-white transition-all shadow-sm flex items-center justify-center border-none cursor-pointer"
                      onClick={() => handleDeleteItem(item)}
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>

                  <div className="p-lg flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h3 className="text-title-lg font-bold text-on-surface leading-tight">{item.name}</h3>
                      <p className="text-body-md text-on-surface-variant line-clamp-2">{item.description}</p>
                    </div>

                    <div className="mt-lg pt-md border-t border-outline-variant/10 flex items-center justify-between">
                      <button 
                        className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant flex items-center justify-center border-none bg-transparent cursor-pointer"
                        onClick={() => openEditModal(item)}
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <span className="text-label-md font-medium text-on-surface-variant">
                        {item.availability ? "Available" : "Unavailable"}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          checked={item.availability} 
                          className="sr-only peer" 
                          type="checkbox"
                          onChange={() => handleToggleAvailability(item)}
                        />
                        <div className="switch-toggle-bg">
                          <div className="switch-toggle-circle"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal View: Add/Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-md">
          {/* Backdrop Overlay */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={closeModal}></div>

          {/* Modal Container */}
          <div className="relative w-full max-w-3xl bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden modal-card flex flex-col">
            {/* Accent Primary Stripe */}
            <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>

            <div className="p-xl max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <header className="mb-xl flex justify-between items-start">
                <div>
                  <h2 className="text-headline-lg text-primary font-bold">
                    {isEditing ? "Edit Menu Item" : "New Menu Item"}
                  </h2>
                  <p className="text-body-md text-on-surface-variant mt-xs">
                    {isEditing 
                      ? "Modify the fields below to update this cafeteria menu dish." 
                      : "Fill in the details below to add a new dish to the Stratizen cafeteria menu."}
                  </p>
                </div>
                <button 
                  className="p-2 hover:bg-surface-container-high rounded-full text-on-surface-variant transition-all flex items-center justify-center border-none bg-transparent cursor-pointer"
                  onClick={closeModal}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>

              {/* Form Content */}
              <form className="grid grid-cols-1 md:grid-cols-2 gap-lg" onSubmit={handleSave}>
                {/* Left Column: Input Fields */}
                <div className="space-y-lg">
                  <div className="space-y-xs">
                    <label className="text-label-lg text-on-surface-variant block font-medium">Food Name</label>
                    <input 
                      className="w-full border border-outline-variant rounded-lg p-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all bg-surface-container-lowest text-on-surface" 
                      placeholder="e.g. Traditional Swahili Pilau" 
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-xs">
                    <label className="text-label-lg text-on-surface-variant block font-medium">Category</label>
                    <div className="relative">
                      <select 
                        className="w-full border border-outline-variant rounded-lg p-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none bg-no-repeat bg-[right_1rem_center] bg-surface-container-lowest text-on-surface"
                        style={{ 
                          backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
                          backgroundSize: "1.25rem"
                        }}
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      >
                        {formCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-xs">
                    <label className="text-label-lg text-on-surface-variant block font-medium">Price (KES)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium">KSh</span>
                      <input 
                        className="w-full border border-outline-variant rounded-lg p-md pl-14 text-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all bg-surface-container-lowest text-on-surface" 
                        placeholder="0.00" 
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-xs">
                    <label className="text-label-lg text-on-surface-variant block font-medium">Availability</label>
                    <div className="flex items-center justify-between p-md border border-outline-variant rounded-lg bg-surface-container-low">
                      <span className="text-body-md text-on-surface">Available for Ordering</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          checked={formData.availability} 
                          className="sr-only peer" 
                          type="checkbox"
                          onChange={(e) => setFormData(prev => ({ ...prev, availability: e.target.checked }))}
                        />
                        <div className="switch-toggle-bg">
                          <div className="switch-toggle-circle"></div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Right Column: Image and Description */}
                <div className="space-y-lg">
                  <div className="space-y-xs">
                    <label className="text-label-lg text-on-surface-variant block font-medium">Item Image</label>
                    <div 
                      className="photo-upload-box relative group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="w-full h-full object-cover" alt="Food preview" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <span className="material-symbols-outlined text-white text-[32px]">edit</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center group-hover:scale-105 transition-transform text-center p-sm">
                          <span className="material-symbols-outlined text-outline text-[40px] mb-sm">add_a_photo</span>
                          <span className="text-label-lg text-on-surface-variant font-medium">Upload Photo</span>
                          <span className="text-label-md text-outline-variant mt-1">PNG, JPG up to 5MB</span>
                        </div>
                      )}
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-xs">
                    <label className="text-label-lg text-on-surface-variant block font-medium">Description</label>
                    <textarea 
                      className="w-full border border-outline-variant rounded-lg p-md text-body-md resize-none focus:border-primary focus:ring-1 focus:ring-primary transition-all bg-surface-container-lowest text-on-surface" 
                      placeholder="Describe the ingredients and preparation..." 
                      rows="4"
                      required
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    ></textarea>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="md:col-span-2 pt-lg border-t border-outline-variant/30 mt-lg flex items-center justify-end gap-md">
                  <button 
                    className="px-xl py-md text-label-lg text-primary border border-primary rounded-lg hover:bg-primary-container/10 transition-all active:scale-95 bg-transparent"
                    type="button"
                    onClick={closeModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button 
                    className={`px-xl py-md text-label-lg text-white rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-sm border-none bg-primary cursor-pointer ${
                      !isFormValid() || isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90"
                    }`}
                    type="submit"
                    disabled={!isFormValid() || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined !text-[18px]">
                          {isEditing ? "save" : "add"}
                        </span>
                        {isEditing ? "Save Changes" : "Add Item"}
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Tips Section */}
              <div className="mt-xl pt-lg border-t border-outline-variant/10 grid grid-cols-1 md:grid-cols-3 gap-lg">
                <div className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-secondary !text-[20px] fill-icon">lightbulb</span>
                  <div>
                    <h4 className="text-label-sm font-bold text-on-surface">Photo Tip</h4>
                    <p className="text-[11px] leading-tight text-on-surface-variant">Bright, well-lit photos increase sales.</p>
                  </div>
                </div>
                <div className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-on-tertiary-container !text-[20px] fill-icon">info</span>
                  <div>
                    <h4 className="text-label-sm font-bold text-on-surface">Pricing</h4>
                    <p className="text-[11px] leading-tight text-on-surface-variant">Include all taxes in KES.</p>
                  </div>
                </div>
                <div className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-error !text-[20px] fill-icon">inventory_2</span>
                  <div>
                    <h4 className="text-label-sm font-bold text-on-surface">Stock</h4>
                    <p className="text-[11px] leading-tight text-on-surface-variant">Toggle availability instantly.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuManager;
