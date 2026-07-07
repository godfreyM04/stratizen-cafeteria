import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { TrayProvider } from "./context/TrayContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Menu from "./pages/Menu";
import FoodDetails from "./pages/FoodDetails";
import Orders from "./pages/Orders";
import Wallet from "./pages/Wallet";
import Checkout from "./pages/Checkout";
import OrderTracking from "./pages/OrderTracking";
import EditProfile from "./pages/EditProfile";
import ChefDashboard from "./pages/ChefDashboard";
import PendingOrders from "./pages/PendingOrders";
import KitchenMonitor from "./pages/KitchenMonitor";
import ReadyForPickup from "./pages/ReadyForPickup";
import OrderHistory from "./pages/OrderHistory";
import MenuManager from "./pages/MenuManager";
import ChefNotifications from "./pages/ChefNotifications";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import "./styles/Toast.css";
import "./styles/QuantityCounter.css";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TrayProvider>
          <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes (guests only) */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              {/* Handle /signup redirect alias */}
              <Route
                path="/signup"
                element={<Navigate to="/register" replace />}
              />

              {/* Protected routes (authenticated users only) */}
              <Route
                path="/menu"
                element={
                  <ProtectedRoute>
                    <Menu />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/food/:id"
                element={
                  <ProtectedRoute>
                    <FoodDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wallet"
                element={
                  <ProtectedRoute>
                    <Wallet />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile/edit"
                element={
                  <ProtectedRoute>
                    <EditProfile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/order-tracking"
                element={
                  <ProtectedRoute>
                    <OrderTracking />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/dashboard"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <ChefDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/pending"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <PendingOrders />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/monitor"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <KitchenMonitor />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/ready"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <ReadyForPickup />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/history"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <OrderHistory />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/menu"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <MenuManager />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chef/notifications"
                element={
                  <ProtectedRoute allowedRole="chef">
                    <ChefNotifications />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="/admin/login"
                element={
                  <PublicRoute>
                    <AdminLogin />
                  </PublicRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRole="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Root redirect */}
              <Route
                path="/"
                element={<Navigate to="/menu" replace />}
              />
            </Routes>
          </BrowserRouter>
          </ToastProvider>
        </TrayProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;