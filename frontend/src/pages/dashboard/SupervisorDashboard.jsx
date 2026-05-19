import { useAuth } from "../../contexts/AuthContext";
import logoImg from "../../assets/otto-logo.svg";

export const SupervisorDashboard = () => {
  const { user, fullName, role, signOut } = useAuth();

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "var(--bg-cream)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      fontFamily: "var(--font-sans)"
    }}>
      <div style={{
        backgroundColor: "var(--bg-white)",
        borderRadius: "12px",
        boxShadow: "var(--shadow-lg)",
        padding: "3rem 2.5rem",
        width: "100%",
        maxWidth: "480px",
        textAlign: "center",
        border: "1px solid var(--border-color)",
        position: "relative"
      }}>
        {/* Status Tag */}
        <span style={{
          position: "absolute",
          top: "1.5rem",
          right: "1.5rem",
          backgroundColor: "#FEF3C7",
          color: "#D97706",
          fontSize: "0.75rem",
          fontWeight: 700,
          textTransform: "uppercase",
          padding: "0.25rem 0.75rem",
          borderRadius: "9999px",
          letterSpacing: "0.05em"
        }}>
          Supervisor
        </span>

        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <img src={logoImg} style={{ width: "64px", height: "64px" }} alt="Logo" />
        </div>

        {/* Greeting */}
        <h2 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.75rem",
          fontWeight: 800,
          color: "var(--text-dark)",
          marginBottom: "0.5rem"
        }}>
          Welcome back,
        </h2>
        <p style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--primary)",
          marginBottom: "1.5rem"
        }}>
          {fullName || "Supervisor User"}
        </p>

        {/* User Info Details */}
        <div style={{
          textAlign: "left",
          backgroundColor: "var(--bg-cream)",
          borderRadius: "8px",
          padding: "1.25rem",
          marginBottom: "2rem",
          fontSize: "0.9rem",
          border: "1px solid var(--border-color)",
          lineHeight: "1.6"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Email:</span>
            <span style={{ color: "var(--text-dark)", fontWeight: 600 }}>{user?.email}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Access Level:</span>
            <span style={{ color: "var(--text-dark)", fontWeight: 600, textTransform: "capitalize" }}>{role}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Inactivity Limit:</span>
            <span style={{ color: "#B45309", fontWeight: 600 }}>30 Minutes</span>
          </div>
        </div>

        {/* Info Box */}
        <p style={{
          fontSize: "0.825rem",
          color: "var(--text-muted)",
          marginBottom: "2rem",
          lineHeight: "1.4"
        }}>
          You are currently in the Supervisor module. Move your mouse or press any key to prevent auto-expiry of your session.
        </p>

        {/* Sign Out Button */}
        <button
          onClick={signOut}
          style={{
            width: "100%",
            padding: "0.875rem",
            backgroundColor: "var(--primary)",
            color: "#ffffff",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "0.95rem",
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = "var(--primary-hover)"}
          onMouseOut={(e) => e.target.style.backgroundColor = "var(--primary)"}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};
export default SupervisorDashboard;
