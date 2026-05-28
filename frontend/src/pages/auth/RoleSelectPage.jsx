import { useNavigate } from "react-router-dom";
import HeroPanel from "../../components/auth/HeroPanel";
import logoImg from "../../assets/otto-logo.svg";
import "../../styles/auth.css";

export const RoleSelectPage = () => {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    navigate(`/login?role=${role}`);
  };

  return (
    <div className="auth-container">
      {/* Left Cover Panel */}
      <HeroPanel />

      {/* Right Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          {/* Logo & Brand */}
          <div className="auth-branding">
            <img src={logoImg} className="auth-logo" alt="OTTO Logo" />
            <span className="auth-brand-name">Otto Shoes</span>
          </div>

          {/* Titles */}
          <h2 className="auth-title">Welcome back!</h2>
          <p className="auth-subtitle">Please select your account type to continue.</p>


          {/* Role Selection Buttons */}
          <button 
            className="auth-role-btn" 
            onClick={() => handleRoleSelect("inventory_clerk")}
            aria-label="Select Inventory Clerk role"
          >
            <span className="auth-role-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span className="auth-role-text">Inventory Clerk</span>
            <span className="auth-role-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>

          <button 
            className="auth-role-btn" 
            onClick={() => handleRoleSelect("supervisor")}
            aria-label="Select Supervisor role"
          >
            <span className="auth-role-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <span className="auth-role-text">Supervisor</span>
            <span className="auth-role-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>

          <button 
            className="auth-role-btn" 
            onClick={() => handleRoleSelect("admin")}
            aria-label="Select Admin role"
          >
            <span className="auth-role-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span className="auth-role-text">Admin</span>
            <span className="auth-role-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>

          {/* Footer Branding */}
          <div className="auth-system-footer">
            Otto Shoes Manufacturing System
          </div>
        </div>
      </div>
    </div>
  );
};
export default RoleSelectPage;
