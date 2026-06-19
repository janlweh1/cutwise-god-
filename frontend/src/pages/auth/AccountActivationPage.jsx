import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import zxcvbn from "zxcvbn";
import api from "../../lib/api";
import HeroPanel from "../../components/auth/HeroPanel";
import logoImg from "../../assets/otto-logo.svg";
import "../../styles/auth.css";

/* ── Password strength config ─────────────────────────────────── */
const STRENGTH_LEVELS = [
  { label: "Too weak",  color: "#EF4444", bg: "#FEE2E2" },
  { label: "Weak",      color: "#F97316", bg: "#FFEDD5" },
  { label: "Fair",      color: "#EAB308", bg: "#FEF9C3" },
  { label: "Good",      color: "#22C55E", bg: "#DCFCE7" },
  { label: "Strong",    color: "#16A34A", bg: "#DCFCE7" },
];

/* ── Requirement checks ───────────────────────────────────────── */
const getRequirements = (pw) => [
  { key: "length",    label: "At least 8 characters",      met: pw.length >= 8 },
  { key: "upper",     label: "One uppercase letter (A–Z)",  met: /[A-Z]/.test(pw) },
  { key: "lower",     label: "One lowercase letter (a–z)",  met: /[a-z]/.test(pw) },
  { key: "number",    label: "One number (0–9)",            met: /[0-9]/.test(pw) },
  { key: "special",   label: "One special character (!@#…)", met: /[^A-Za-z0-9]/.test(pw) },
];

/* ── Strength Bar ─────────────────────────────────────────────── */
const StrengthBar = ({ score, visible }) => {
  if (!visible) return null;
  const level = STRENGTH_LEVELS[score];
  return (
    <div style={{ marginTop: "0.5rem" }}>
      {/* Segmented bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
        {STRENGTH_LEVELS.map((l, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: "5px",
              borderRadius: "99px",
              background: i <= score ? l.color : "#E5E7EB",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      {/* Label */}
      <div style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        color: level.color,
        letterSpacing: "0.02em",
      }}>
        {level.label}
      </div>
    </div>
  );
};

/* ── Requirement Item ─────────────────────────────────────────── */
const Req = ({ met, label }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "0.8rem",
    color: met ? "#16A34A" : "#6B7280",
    transition: "color 0.2s",
  }}>
    <div style={{
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: met ? "#DCFCE7" : "#F3F4F6",
      border: `1.5px solid ${met ? "#22C55E" : "#D1D5DB"}`,
      transition: "all 0.2s",
    }}>
      {met ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </div>
    {label}
  </div>
);

/* ── Eye toggle button ────────────────────────────────────────── */
const EyeToggle = ({ show, onToggle }) => (
  <button
    type="button"
    className="auth-password-toggle"
    onClick={onToggle}
    tabIndex="-1"
    aria-label={show ? "Hide password" : "Show password"}
  >
    {show ? (
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
);

/* ══════════════════════════════════════════════════════════════
   AccountActivationPage
   ══════════════════════════════════════════════════════════════ */
export const AccountActivationPage = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [touched, setTouched]               = useState(false);
  const [message, setMessage]               = useState("");
  const [error, setError]                   = useState("");
  const [submitting, setSubmitting]         = useState(false);

  /* Live strength + requirements */
  const strength   = useMemo(() => zxcvbn(password), [password]);
  const score      = password.length === 0 ? 0 : strength.score;
  const reqs       = useMemo(() => getRequirements(password), [password]);
  const allReqsMet = reqs.every((r) => r.met);

  /* zxcvbn suggestions (deduplicated) */
  const suggestions = useMemo(() => {
    const arr = [];
    if (strength.feedback?.warning) arr.push(strength.feedback.warning);
    strength.feedback?.suggestions?.forEach((s) => arr.push(s));
    return [...new Set(arr)];
  }, [strength]);

  const confirmMismatch = touched && confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);

    if (!allReqsMet) {
      setError("Please meet all password requirements before continuing.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await api.post("/auth/activate/", { uid, token, password });
      setMessage("Your account has been activated! Redirecting to login...");
      setTimeout(() => navigate("/", { replace: true }), 2500);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "This activation link is invalid or has expired. Please contact your administrator."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <HeroPanel />

      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          {/* Logo & Brand */}
          <div className="auth-branding">
            <img src={logoImg} className="auth-logo" alt="OTTO Logo" />
            <span className="auth-brand-name">Otto Shoes</span>
          </div>

          <h2 className="auth-title">Activate Your Account</h2>
          <p className="auth-subtitle">
            Welcome! Set a strong password to activate your account.
          </p>

          {/* Alert Boxes */}
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

          {message && (
            <div className="auth-error-box" style={{ backgroundColor: "#ECFDF5", borderColor: "rgba(16, 185, 129, 0.2)", color: "#065F46" }} role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          {/* Activation Form */}
          {!message && (
            <form onSubmit={handleSubmit} className="auth-form">

              {/* ── Password field ── */}
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
                    placeholder="Set Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setTouched(true); }}
                    disabled={submitting}
                    required
                  />
                  <EyeToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                </div>

                {/* Strength bar — shown once user starts typing */}
                <StrengthBar score={score} visible={password.length > 0} />

                {/* zxcvbn suggestions */}
                {password.length > 0 && suggestions.length > 0 && score < 3 && (
                  <div style={{
                    marginTop: "6px",
                    fontSize: "0.75rem",
                    color: "#6B7280",
                    fontStyle: "italic",
                    lineHeight: 1.4,
                  }}>
                    💡 {suggestions[0]}
                  </div>
                )}

                {/* Requirements checklist */}
                {password.length > 0 && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    marginTop: "10px",
                    padding: "10px 12px",
                    background: "#F9FAFB",
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                  }}>
                    {reqs.map((r) => <Req key={r.key} met={r.met} label={r.label} />)}
                  </div>
                )}
              </div>

              {/* ── Confirm Password field ── */}
              <div className="auth-form-group">
                <div className="auth-input-wrapper">
                  <span className="auth-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    className="auth-input"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setTouched(true); }}
                    disabled={submitting}
                    required
                    style={{
                      borderColor: confirmMismatch ? "#EF4444" : undefined,
                      boxShadow: confirmMismatch ? "0 0 0 3px rgba(239,68,68,0.1)" : undefined,
                    }}
                  />
                  <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                </div>
                {confirmMismatch && (
                  <div style={{ marginTop: "5px", fontSize: "0.78rem", color: "#EF4444", fontWeight: 500 }}>
                    Passwords do not match.
                  </div>
                )}
                {!confirmMismatch && confirmPassword.length > 0 && password === confirmPassword && (
                  <div style={{ marginTop: "5px", fontSize: "0.78rem", color: "#16A34A", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Passwords match
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={submitting}
              >
                {submitting ? <div className="auth-spinner"></div> : "Activate Account"}
              </button>
            </form>
          )}

          {error && !message && (
            <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Please contact your administrator to resend the activation email.
            </p>
          )}

          <div className="auth-system-footer">
            Otto Shoes Manufacturing System
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountActivationPage;
