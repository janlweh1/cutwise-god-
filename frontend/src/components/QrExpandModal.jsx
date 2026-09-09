import { useState } from "react";
import trackerApi from "../lib/trackerApi";

export default function QrExpandModal({
  token,
  scrapName = "Leather Scrap Offcut",
  bin,
  grade,
  weightKg,
  dimensions,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const scanUrl = `${window.location.origin}/scan/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1200,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(5px)",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: "92%",
          padding: "1.75rem",
          borderRadius: "18px",
          textAlign: "center",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4)",
          background: "#ffffff",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1rem",
            borderBottom: "1px solid var(--border-color)",
            paddingBottom: "0.75rem",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                color: "var(--primary)",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
              }}
            >
              OTTO Physical Asset QR
            </span>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: "var(--text-dark)",
                marginTop: "2px",
              }}
            >
              {scrapName}
            </h3>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            style={{ fontSize: "1.5rem", lineHeight: 1, padding: "2px 6px" }}
          >
            &times;
          </button>
        </div>

        {/* Big Crisp QR Code */}
        <div
          style={{
            background: "#ffffff",
            padding: "1rem",
            borderRadius: "16px",
            border: "2px solid var(--border-color)",
            display: "inline-block",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
            margin: "0.5rem auto 1rem",
          }}
        >
          <img
            src={trackerApi.getQrImageUrl(token, 500)}
            alt="Scannable QR Code"
            style={{
              width: 270,
              height: 270,
              display: "block",
              imageRendering: "pixelated",
              borderRadius: "4px",
            }}
          />
        </div>

        {/* Meta badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            marginBottom: "0.85rem",
            flexWrap: "wrap",
          }}
        >
          {bin && (
            <span
              style={{
                background: "var(--bg-cream)",
                border: "1px solid var(--border-color)",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "var(--primary)",
              }}
            >
              BIN: {bin}
            </span>
          )}
          {grade && (
            <span
              style={{
                background: "#1F2937",
                color: "#ffffff",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {grade.replace("_", " ")}
            </span>
          )}
          {weightKg && (
            <span
              style={{
                background: "#F3F4F6",
                color: "var(--text-dark)",
                padding: "3px 10px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {Number(weightKg).toFixed(3)} kg
            </span>
          )}
        </div>

        {dimensions && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            Dimensions: <strong>{dimensions}</strong>
          </div>
        )}

        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            marginBottom: "1.25rem",
            lineHeight: 1.4,
          }}
        >
          Point any smartphone camera or handheld barcode scanner at the code to inspect specs and claim this scrap.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{
              fontSize: "0.82rem",
              padding: "7px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "Copied Link!" : "Copy Scan URL"}
          </button>

          <a
            href={scanUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{
              fontSize: "0.82rem",
              padding: "7px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open Live Scanner
          </a>
        </div>
      </div>
    </div>
  );
}
