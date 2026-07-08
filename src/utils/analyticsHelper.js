/**
 * analyticsHelper.js
 * 
 * Shared calculation and aggregation logic for analytics,
 * reused across Reports & Analytics, Chef Order History, and PDF Reports.
 */

// Helper to get Monday-to-Sunday dates for the current calendar week
export const getDatesForCurrentWeek = () => {
  const current = new Date();
  const day = current.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(current);
  monday.setDate(current.getDate() + distanceToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  return weekDates;
};

// Calculates total revenue, avg daily revenue, total orders, avg order value, and avg prep time
export const calculateCoreMetrics = (completedOrders) => {
  const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const completedOrdersCount = completedOrders.length;

  // Average daily revenue: Total Revenue / unique days with completed orders
  const uniqueDays = new Set(completedOrders.map((o) => new Date(o.created_at || o.collected_at).toDateString()));
  const numDays = uniqueDays.size || 1;
  const avgDailyRevenue = totalRevenue / numDays;

  // Average order value
  const avgOrderValue = completedOrdersCount > 0 ? totalRevenue / completedOrdersCount : 0;

  // Average preparation time: (ready_at - prep_started_at)
  const prepOrders = completedOrders.filter((o) => o.prep_started_at && o.ready_at);
  let avgPrepTimeMins = 0;
  if (prepOrders.length > 0) {
    const totalPrepTimeMs = prepOrders.reduce((sum, o) => {
      const start = new Date(o.prep_started_at).getTime();
      const ready = new Date(o.ready_at).getTime();
      return sum + Math.max(0, ready - start);
    }, 0);
    const avgPrepMs = totalPrepTimeMs / prepOrders.length;
    avgPrepTimeMins = Math.round(avgPrepMs / 60000);
  }

  return {
    completedOrdersCount,
    totalRevenue,
    avgDailyRevenue,
    avgOrderValue,
    avgPrepTimeMins,
  };
};

// Calculates weekly Monday-to-Sunday revenue trend using day-boundary checking
export const calculateWeeklyRevenueTrend = (completedOrders) => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekDates = getDatesForCurrentWeek();
  
  const dailyStats = weekDates.map((date, index) => {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    // Filter orders matching the start and end of this weekday
    const dayOrders = completedOrders.filter(o => {
      const d = new Date(o.created_at || o.collected_at);
      return d >= date && d < nextDay;
    });

    const value = dayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

    return {
      name: days[index],
      label: days[index].substring(0, 3),
      value
    };
  });

  const maxRevenue = Math.max(...dailyStats.map(d => d.value), 1000);

  return dailyStats.map(stat => ({
    ...stat,
    heightPct: stat.value > 0 ? Math.max((stat.value / maxRevenue) * 100, 2) : 0,
  }));
};

// Calculates top performing menu items ranked by quantity ordered
export const calculateTopMenuItems = (completedOrders) => {
  const itemMap = {};

  completedOrders.forEach((order) => {
    (order.order_items || []).forEach((oi) => {
      const itemId = oi.menu?.id || oi.menu_item_id;
      const itemName = oi.menu?.name || oi.menu_name;
      const itemImage = oi.menu?.image_url || oi.menu_image_url;
      if (itemId && itemName) {
        if (!itemMap[itemId]) {
          itemMap[itemId] = {
            name: itemName,
            image: itemImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
            count: 0,
          };
        }
        itemMap[itemId].count += oi.quantity;
      }
    });
  });

  return Object.values(itemMap).sort((a, b) => b.count - a.count);
};

// Calculates kitchen staff performance ranked by completed orders count
export const calculateTopChefs = (completedOrders, chefsList) => {
  const chefCounts = {};

  completedOrders.forEach((order) => {
    let chefId = order.assigned_chef_id;
    if (!chefId && order.notes) {
      const match = order.notes.match(/ChefID:([a-f0-9-]+)/);
      if (match) chefId = match[1];
    }
    if (chefId) {
      chefCounts[chefId] = (chefCounts[chefId] || 0) + 1;
    }
  });

  return chefsList
    .map((chef) => ({
      id: chef.id,
      name: chef.full_name,
      completedCount: chefCounts[chef.id] || 0,
    }))
    .sort((a, b) => b.completedCount - a.completedCount);
};
