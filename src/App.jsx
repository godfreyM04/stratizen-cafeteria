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
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
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