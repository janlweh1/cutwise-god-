import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import HeroPanel from "../../components/auth/HeroPanel";
import logoImg from "../../assets/otto-logo.svg";
import "../../styles/auth.css";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await api.post("/auth/forgot-password/", { email });
      setMessage("Password reset link has been sent to your email address.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send reset link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Cover Panel */}
      <HeroPanel />

      {/* Right Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          {/* Back to login */}
          <Link to="/" className="auth-back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to login
          </Link>

          {/* Logo & Brand */}
          <div className="auth-branding">
            <img src={logoImg} className="auth-logo" alt="OTTO Logo" />
            <span className="auth-brand-name">Otto Shoes</span>
          </div>

          {/* Titles */}
          <h2 className="auth-title">Forgot Password?</h2>
          <p className="auth-subtitle">
            Enter your email address and we will send you a link to reset your password.
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

          {/* Request Form */}
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

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={submitting}
            >
              {submitting ? <div className="auth-spinner"></div> : "Send Reset Link"}
            </button>
          </form>

          {/* Footer Branding */}
          <div className="auth-system-footer">
            Otto Shoes Manufacturing System
          </div>
        </div>
      </div>
    </div>
  );
};
export default ForgotPasswordPage;
