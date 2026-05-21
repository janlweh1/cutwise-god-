import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import HeroPanel from "../../components/auth/HeroPanel";
import logoImg from "../../assets/otto-logo.svg";
import { supabase } from "../../lib/supabaseClient";
import { logRemote } from "../../lib/logger";
import "../../styles/auth.css";

export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signOut } = useAuth();

  const roleParam = searchParams.get("role")?.toLowerCase();
  const validRoles = ["employee", "admin", "supervisor"];

  // Redirect if role is invalid
  useEffect(() => {
    if (!roleParam || !validRoles.includes(roleParam)) {
      navigate("/", { replace: true });
    }
  }, [roleParam, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Capitalize helper
  const capitalize = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    logRemote(`LoginPage: handleSubmit triggered for email=${email}, role=${roleParam}`, "info");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      // 1. Sign in user
      logRemote("LoginPage: calling signIn...", "info");
      const data = await signIn(email, password);
      logRemote(`LoginPage: signIn resolved. user_id=${data?.user?.id}`, "info");

      // 2. Fetch profile from public.profiles to verify role
      logRemote("LoginPage: fetching profile...", "info");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}&select=role`;
      const response = await fetch(url, {
        headers: {
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      logRemote(`LoginPage: response status=${response.status}`, "info");
      const text = await response.text();
      logRemote(`LoginPage: response body=${text}`, "info");
      
      const parsed = JSON.parse(text);
      const profile = parsed && parsed.length > 0 ? parsed[0] : null;

      if (!profile) {
        logRemote("LoginPage: profile empty or error, signing out...", "warn");
        await signOut();
        setError("Error verifying user profile. Please try again.");
        setSubmitting(false);
        return;
      }

      // 3. Verify user's actual role matches the selected login role
      if (profile.role !== roleParam) {
        logRemote(`LoginPage: role mismatch: profile.role=${profile.role} vs roleParam=${roleParam}, signing out...`, "warn");
        await signOut();
        setError(`Access Denied: Your account does not have the "${capitalize(roleParam)}" role.`);
        setSubmitting(false);
        return;
      }

      // 4. Handle remember me
      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }

      // 5. Redirect based on role
      logRemote(`LoginPage: redirecting to /dashboard/${roleParam}`, "info");
      navigate(`/dashboard/${roleParam}`, { replace: true });
    } catch (err) {
      logRemote(`LoginPage: exception caught: ${err.message || err}`, "error");
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
      logRemote("LoginPage: handleSubmit completed", "info");
    }
  };

  // Populate remembered email on load
  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const [debugLogs, setDebugLogs] = useState([]);

  useEffect(() => {
    const updateLogs = () => {
      try {
        const stored = localStorage.getItem("debug_logs");
        if (stored) {
          setDebugLogs(JSON.parse(stored));
        } else {
          setDebugLogs([]);
        }
      } catch (e) {}
    };

    updateLogs();
    window.addEventListener("debug_logs_updated", updateLogs);
    return () => window.removeEventListener("debug_logs_updated", updateLogs);
  }, []);

  return (
    <div className="auth-container">
      {/* Left Cover Panel */}
      <HeroPanel />

      {/* Right Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          {/* Back to roles */}
          <Link to="/" className="auth-back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to roles
          </Link>

          {/* Logo & Brand */}
          <div className="auth-branding">
            <img src={logoImg} className="auth-logo" alt="OTTO Logo" />
            <span className="auth-brand-name">Otto Shoes</span>
          </div>

          {/* Titles */}
          <h2 className="auth-title">Welcome back!</h2>
          <p className="auth-subtitle">
            Signing in as <strong>{capitalize(roleParam)}</strong>. Please enter your credentials.
          </p>

          {/* Error Message Box */}
          {error && (
            <div className="auth-error-box" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-form-group">
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="auth-form-group">
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox and Forgot Row */}
            <div className="auth-flex-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  className="auth-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="auth-forgot-link">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={submitting}
            >
              {submitting ? <div className="auth-spinner"></div> : "Sign In"}
            </button>
          </form>

          {/* Live Debug Logs Console */}
          <div style={{
            marginTop: '25px',
            padding: '12px',
            background: '#121214',
            border: '1px solid #333',
            color: '#a9b1d6',
            fontFamily: 'Consolas, monospace',
            fontSize: '11px',
            borderRadius: '6px',
            textAlign: 'left',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              fontWeight: 'bold',
              color: '#7aa2f7',
              borderBottom: '1px solid #2f343f',
              paddingBottom: '6px',
              marginBottom: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>⚙️ LIVE AUTH PROCESS TRACE:</span>
              <button 
                type="button" 
                onClick={() => { localStorage.removeItem("debug_logs"); setDebugLogs([]); }}
                style={{
                  background: 'transparent',
                  border: '1px solid #7aa2f7',
                  color: '#7aa2f7',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '9px',
                  padding: '2px 6px',
                  transition: 'all 0.2s'
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ maxHeight: '120px', overflowY: 'auto', lineHeight: '1.5' }}>
              {debugLogs.length === 0 ? (
                <div style={{ color: '#565f89', fontStyle: 'italic' }}>No logs recorded yet. Try clicking "Sign In".</div>
              ) : (
                debugLogs.map((log, index) => {
                  let logColor = '#a9b1d6';
                  if (log.includes('[ERROR]')) logColor = '#f7768e';
                  if (log.includes('[WARN]')) logColor = '#e0af68';
                  if (log.includes('resolved') || log.includes('succeeded') || log.includes('redirecting')) logColor = '#9ece6a';
                  return <div key={index} style={{ color: logColor }}>{log}</div>;
                })
              )}
            </div>
          </div>

          {/* Footer Branding */}
          <div className="auth-system-footer">
            Otto Shoes Manufacturing System
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
