import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import AccountActivationPage from "./pages/auth/AccountActivationPage";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import SupervisorDashboard from "./pages/dashboard/SupervisorDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
          <Route path="/activate/:uid/:token" element={<AccountActivationPage />} />

          {/* Protected Dashboards */}
          <Route 
            path="/dashboard/inventory_clerk" 
            element={
              <ProtectedRoute requiredRole="inventory_clerk">
                <EmployeeDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/supervisor" 
            element={
              <ProtectedRoute requiredRole="supervisor">
                <SupervisorDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
