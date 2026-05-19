import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--bg-cream)",
        gap: "1.5rem"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "4px solid rgba(123, 31, 31, 0.1)",
          borderRadius: "50%",
          borderTopColor: "var(--primary)",
          animation: "spin 1s linear infinite"
        }}></div>
        <p style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--primary)"
        }}>Verifying credentials...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // User is not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated but doesn't have the required role
  if (requiredRole && role !== requiredRole) {
    // Redirect to their own dashboard if role exists
    if (role === "admin") return <Navigate to="/dashboard/admin" replace />;
    if (role === "supervisor") return <Navigate to="/dashboard/supervisor" replace />;
    if (role === "employee") return <Navigate to="/dashboard/employee" replace />;
    
    return <Navigate to="/" replace />;
  }

  return children;
};
export default ProtectedRoute;
