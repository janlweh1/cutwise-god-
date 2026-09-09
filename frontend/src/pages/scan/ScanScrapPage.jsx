import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import trackerApi from "../../lib/trackerApi";
import { getAccessToken } from "../../lib/api";
import QrExpandModal from "../../components/QrExpandModal";

const fmtDate = (str) => {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return str;
  }
};

export default function ScanScrapPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [scrap, setScrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notif, setNotif] = useState(null);

  // Modals
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [productionOrder, setProductionOrder] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const [destinationBin, setDestinationBin] = useState("");
  const [relocateNotes, setRelocateNotes] = useState("");
  const [submittingRelocate, setSubmittingRelocate] = useState(false);

  const showNotification = (msg, type = "success") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 5000);
  };

  const loadScrapData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await trackerApi.resolveScan(token);
      setScrap(data);
      setDestinationBin(data.storage_bin || "");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          "Could not resolve QR code. Please verify the tag or contact a supervisor."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadScrapData();
    }
  }, [token]);

  const handleFetchHistory = async () => {
    if (!scrap?.scrap_id) return;
    setLoadingHistory(true);
    try {
      const events = await trackerApi.getScrapEvents(scrap.scrap_id);
      setHistoryEvents(events);
    } catch (err) {
      console.error(err);
      showNotification("Could not load scan history.", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!showHistory) {
      handleFetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleClaim = async (e) => {
    e.preventDefault();
    if (!productionOrder.trim()) {
      showNotification("Please specify a production order or batch code.", "error");
      return;
    }
    setSubmittingClaim(true);
    try {
      const res = await trackerApi.claimScrap(token, {
        production_order: productionOrder.trim(),
        notes: claimNotes.trim(),
      });
      showNotification(res.message || "Scrap successfully claimed for production!");
      setShowClaimModal(false);
      setProductionOrder("");
      setClaimNotes("");
      loadScrapData();
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to claim scrap.";
      showNotification(detail, "error");
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleRelocate = async (e) => {
    e.preventDefault();
    if (!destinationBin.trim()) {
      showNotification("Please specify the new bin coordinate.", "error");
      return;
    }
    setSubmittingRelocate(true);
    try {
      const res = await trackerApi.relocateScrap(token, {
        destination_bin: destinationBin.trim(),
        notes: relocateNotes.trim(),
      });
      showNotification(`Relocated to ${res.destination_bin}!`);
      setShowRelocateModal(false);
      setRelocateNotes("");
      loadScrapData();
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to relocate scrap.";
      showNotification(detail, "error");
    } finally {
      setSubmittingRelocate(false);
    }
  };

  const isLoggedIn = !!getAccessToken();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-cream)" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", marginBottom: "0.5rem" }}>
            Scanning Scrap Asset…
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Resolving tag token with CutWise IMS</div>
        </div>
      </div>
    );
  }

  if (error || !scrap) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "var(--bg-cream)" }}>
        <div style={{ maxWidth: 440, width: "100%", background: "#fff", padding: "2rem", borderRadius: "12px", boxShadow: "var(--shadow-md)", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ fontSize: "1.25rem", color: "var(--text-dark)", marginBottom: "0.5rem" }}>Scrap Tag Not Found</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>{error}</p>
          <button
            onClick={() => navigate("/")}
            style={{ padding: "0.6rem 1.25rem", background: "var(--primary)", color: "#fff", borderRadius: "8px", fontWeight: 600 }}
          >
            Return to CutWise
          </button>
        </div>
      </div>
    );
  }

  const isAvailable = scrap.status === "available";
  const isClaimed = scrap.status === "claimed";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-cream)", padding: "1.5rem 1rem", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 540, width: "100%" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: scrap.upstream_status === "online" ? "#059669" : "#D97706" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
              {scrap.upstream_status === "online" ? "CutWise IMS Connected" : "Offline Cache"}
            </span>
          </div>
          {isLoggedIn ? (
            <button
              onClick={() => navigate(-1)}
              style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600 }}
            >
              ← Back to App
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600 }}
            >
              Log In
            </button>
          )}
        </div>

        {/* Notification Toast */}
        {notif && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: notif.type === "error" ? "#FEE2E2" : "#D1FAE5",
              color: notif.type === "error" ? "#991B1B" : "#065F46",
              border: `1px solid ${notif.type === "error" ? "#FCA5A5" : "#6EE7B7"}`,
            }}
          >
            {notif.msg}
          </div>
        )}

        {/* Main Card */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "1.5rem", boxShadow: "var(--shadow-md)", border: "1px solid var(--border-color)" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem", marginBottom: "1.2rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                OTTO Leather Tracker
              </div>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-dark)", marginTop: "2px" }}>
                {scrap.material_name}
              </h1>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "capitalize" }}>
                Category: {scrap.material_type} &bull; ID #{String(scrap.scrap_id).slice(0, 8)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  background: isAvailable ? "#D1FAE5" : isClaimed ? "#EDE9FE" : "#F3F4F6",
                  color: isAvailable ? "#059669" : isClaimed ? "#6D28D9" : "#6B7280",
                }}
              >
                {scrap.status}
              </span>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  background: "#fff",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-dark)",
                  cursor: "pointer",
                }}
                title="Expand scannable QR code"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                QR Code
              </button>
            </div>
          </div>

          {/* Key Metric Badges */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <div style={{ background: "var(--bg-cream)", padding: "0.85rem", borderRadius: "10px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Weight
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-dark)" }}>
                {scrap.weight_kg?.toFixed(3)} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>kg</span>
              </div>
            </div>

            <div style={{ background: "var(--bg-cream)", padding: "0.85rem", borderRadius: "10px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Storage Bin
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)" }}>
                {scrap.storage_bin || "UNASSIGNED"}
              </div>
            </div>
          </div>

          {/* Physical Geometry & Grading */}
          <div style={{ background: "#FAFAFA", borderRadius: "10px", padding: "1rem", border: "1px solid var(--border-color)", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-dark)", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between" }}>
              <span>Physical Geometry & Grade</span>
              <span style={{ textTransform: "uppercase", background: "#1F2937", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "0.68rem" }}>
                {scrap.grade?.replace("_", " ")}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Usable Dimensions: </span>
                <strong>
                  {scrap.length_cm ? `${scrap.length_cm} × ${scrap.width_cm} cm` : "Not recorded"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Estimated Area: </span>
                <strong>
                  {scrap.estimated_area_sqcm ? `${scrap.estimated_area_sqcm} cm²` : "—"}
                </strong>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {isAvailable && (
              <button
                onClick={() => setShowClaimModal(true)}
                style={{
                  padding: "0.85rem",
                  background: "#059669",
                  color: "#fff",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 2px 4px rgba(5, 150, 105, 0.25)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Claim for Production
              </button>
            )}

            {isClaimed && (
              <div style={{ padding: "0.75rem", background: "#EDE9FE", color: "#6D28D9", borderRadius: "8px", textAlign: "center", fontWeight: 700, fontSize: "0.85rem" }}>
                Already Claimed for Shoe Assembly
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button
                onClick={() => setShowRelocateModal(true)}
                style={{
                  padding: "0.65rem",
                  border: "1.5px solid var(--border-color)",
                  background: "#fff",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "var(--text-dark)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Relocate Bin
              </button>

              <button
                onClick={toggleHistory}
                style={{
                  padding: "0.65rem",
                  border: "1.5px solid var(--border-color)",
                  background: "#fff",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "var(--text-dark)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {showHistory ? "Hide History" : "Scan History"}
              </button>
            </div>
          </div>

          {/* Scan History Section */}
          {showHistory && (
            <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
              <h3 style={{ fontSize: "0.9rem", fontWeight: 800, marginBottom: "0.75rem", color: "var(--text-dark)" }}>
                Custody & Scan Events
              </h3>
              {loadingHistory ? (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading telemetry stream…</div>
              ) : historyEvents.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No previous scan events recorded.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {historyEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: "8px 10px",
                        background: "#FAFAFA",
                        borderRadius: "6px",
                        borderLeft: `3px solid ${
                          ev.purpose === "production_claim"
                            ? "#059669"
                            : ev.purpose === "relocation"
                            ? "#2563EB"
                            : "#6B7280"
                        }`,
                        fontSize: "0.78rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span style={{ textTransform: "capitalize" }}>{ev.purpose.replace("_", " ")}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{fmtDate(ev.timestamp)}</span>
                      </div>
                      <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                        By: <strong>{ev.scanned_by_name || "Operator"}</strong>
                        {ev.source_bin && ev.destination_bin && (
                          <span> &bull; {ev.source_bin} → {ev.destination_bin}</span>
                        )}
                      </div>
                      {ev.notes && <div style={{ marginTop: "2px", fontStyle: "italic" }}>"{ev.notes}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Claim Modal */}
        {showClaimModal && (
          <div className="modal-overlay" onClick={() => setShowClaimModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <h3>Claim for Shoe Production</h3>
                <button className="modal-close" onClick={() => setShowClaimModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleClaim} className="modal-form">
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                  Deduct this scrap from available inventory to use in a production batch.
                </p>

                <div className="form-group">
                  <label className="form-label">Production Order / Shoe Model *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Model Oxford-42 Batch #104"
                    value={productionOrder}
                    onChange={(e) => setProductionOrder(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operator Notes</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="e.g. For vamp and quarter cuts"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                  />
                </div>

                <div className="modal-actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowClaimModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingClaim}
                    style={{ background: "#059669" }}
                  >
                    {submittingClaim ? "Confirming…" : "Confirm Claim"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Relocate Modal */}
        {showRelocateModal && (
          <div className="modal-overlay" onClick={() => setShowRelocateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <h3>Relocate Storage Bin</h3>
                <button className="modal-close" onClick={() => setShowRelocateModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleRelocate} className="modal-form">
                <div className="form-group">
                  <label className="form-label">Current Bin</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scrap.storage_bin || "UNASSIGNED"}
                    disabled
                    style={{ background: "#F3F4F6", color: "#6B7280" }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Destination Bin Coordinate *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. RACK-B / SHELF-3 / BIN-12"
                    value={destinationBin}
                    onChange={(e) => setDestinationBin(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Relocation Reason / Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Reorganizing cutting shelf"
                    value={relocateNotes}
                    onChange={(e) => setRelocateNotes(e.target.value)}
                  />
                </div>

                <div className="modal-actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRelocateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingRelocate}>
                    {submittingRelocate ? "Saving…" : "Update Location"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showQrModal && (
          <QrExpandModal
            token={token}
            scrapName={scrap.material_name}
            bin={scrap.storage_bin}
            grade={scrap.grade}
            weightKg={scrap.weight_kg}
            dimensions={scrap.length_cm && scrap.width_cm ? `${scrap.length_cm} × ${scrap.width_cm} cm` : null}
            onClose={() => setShowQrModal(false)}
          />
        )}
      </div>
    </div>
  );
}
