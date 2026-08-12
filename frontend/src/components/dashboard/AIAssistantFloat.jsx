import { useState, useRef, useEffect, useCallback } from "react";
import api from "../../lib/api";

/* ─── Colour palette (matches CutWise brand) ──────────────────────────────── */
const BRAND     = "#7B1F1F";   // dark red
const BRAND_LT  = "#C9252C";  // bright red
const RISK_COLORS = {
  CRITICAL: "#DC2626",
  HIGH:     "#D97706",
  MEDIUM:   "#2563EB",
  LOW:      "#059669",
};

/* ─── Suggested prompts ──────────────────────────────────────────────────── */
const SUGGESTIONS = [
  "Which materials are critically low on stock?",
  "What should I reorder this week?",
  "Summarize the current inventory risk.",
  "Which suppliers have the most at-risk materials?",
];

/* ─── Tiny markdown-like formatter (bold, newline) ───────────────────────── */
const formatReply = (text) => {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )}
        <br />
      </span>
    );
  });
};

/* ─── Source card ─────────────────────────────────────────────────────────── */
const SourceCard = ({ src }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.4rem 0.65rem",
    borderRadius: "8px",
    background: `${RISK_COLORS[src.risk_level] || "#6B7280"}12`,
    border: `1px solid ${RISK_COLORS[src.risk_level] || "#6B7280"}30`,
    fontSize: "0.72rem",
  }}>
    <span style={{
      width: "8px", height: "8px", borderRadius: "50%",
      background: RISK_COLORS[src.risk_level] || "#6B7280",
      flexShrink: 0,
    }} />
    <span style={{ fontWeight: 700, color: "#111827" }}>{src.material_name}</span>
    <span style={{ color: "#6B7280", textTransform: "capitalize" }}>({src.material_type})</span>
    <span style={{
      marginLeft: "auto",
      padding: "0.1rem 0.45rem",
      borderRadius: "99px",
      background: `${RISK_COLORS[src.risk_level] || "#6B7280"}22`,
      color: RISK_COLORS[src.risk_level] || "#6B7280",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      fontSize: "0.65rem",
    }}>{src.risk_level}</span>
    <span style={{ color: "#374151", fontWeight: 600 }}>Qty: {src.quantity}</span>
  </div>
);

/* ─── TTS speaker button ──────────────────────────────────────────────────── */
const TTSButton = ({ text }) => {
  const [speaking, setSpeaking] = useState(false);

  const handleTTS = () => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.rate = 1.0;
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
    setSpeaking(true);
  };

  if (!window.speechSynthesis) return null;

  return (
    <button
      onClick={handleTTS}
      title={speaking ? "Stop reading" : "Read aloud"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0.15rem 0.3rem",
        borderRadius: "6px",
        color: speaking ? BRAND : "#9CA3AF",
        fontSize: "0.7rem",
        display: "flex",
        alignItems: "center",
        gap: "0.2rem",
        transition: "color 0.15s",
      }}
    >
      {speaking ? (
        /* stop icon */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      ) : (
        /* speaker icon */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      )}
      {speaking ? "Stop" : "Read"}
    </button>
  );
};

/* ─── Chat message bubble ────────────────────────────────────────────────── */
const MessageBubble = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: "0.85rem",
      gap: "0.35rem",
    }}>
      {/* Role label + TTS for AI messages */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem",
        flexDirection: isUser ? "row-reverse" : "row",
      }}>
        <span style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          color: isUser ? BRAND : "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          paddingLeft: isUser ? 0 : "0.25rem",
          paddingRight: isUser ? "0.25rem" : 0,
        }}>
          {isUser ? "You" : "✦ CutWise AI"}
        </span>
        {!isUser && msg.content && <TTSButton text={msg.content} />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: "85%",
        padding: "0.65rem 0.9rem",
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        background: isUser ? BRAND : "#F9FAFB",
        color: isUser ? "#fff" : "#111827",
        fontSize: "0.82rem",
        lineHeight: 1.55,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: isUser ? "none" : "1px solid #E5E7EB",
      }}>
        {isUser ? msg.content : formatReply(msg.content)}
      </div>

      {/* Source cards (AI messages only) */}
      {!isUser && msg.sources && msg.sources.length > 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem",
          width: "100%",
          maxWidth: "85%",
          paddingLeft: "0.25rem",
        }}>
          <span style={{ fontSize: "0.65rem", color: "#9CA3AF", fontWeight: 600, marginBottom: "0.1rem" }}>
            Sources ({msg.sources.length} material{msg.sources.length !== 1 ? "s" : ""})
          </span>
          {msg.sources.map((s, i) => <SourceCard key={i} src={s} />)}
        </div>
      )}
    </div>
  );
};

/* ─── Typing indicator ───────────────────────────────────────────────────── */
const TypingIndicator = () => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.85rem" }}>
    <div style={{
      padding: "0.65rem 0.9rem",
      borderRadius: "4px 16px 16px 16px",
      background: "#F9FAFB",
      border: "1px solid #E5E7EB",
      display: "flex",
      gap: "4px",
      alignItems: "center",
    }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span key={i} style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: "#9CA3AF",
          animation: `aiDot 1.2s ease-in-out ${delay}s infinite`,
        }} />
      ))}
    </div>
  </div>
);

/* ─── Contextual Alert Card ───────────────────────────────────────────────── */
const ContextualAlertCard = ({ summary, criticalCount, onPrompt }) => {
  if (!criticalCount || criticalCount === 0) return null;
  const avgDays = summary?.avg_days_to_min_stock;
  const avgDaysStr = avgDays && Number(avgDays) < 999
    ? `Avg ${Number(avgDays).toFixed(1)} days to stockout`
    : null;

  return (
    <div style={{
      background: "#FFF7ED",
      border: "1.5px solid #FED7AA",
      borderRadius: "12px",
      padding: "0.75rem 0.9rem",
      marginBottom: "0.75rem",
      animation: "aiFadeIn 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "1rem" }}>⚠️</span>
        <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#92400E" }}>
          {criticalCount} material{criticalCount !== 1 ? "s" : ""} at CRITICAL stock risk
        </span>
      </div>
      {avgDaysStr && (
        <div style={{ fontSize: "0.72rem", color: "#B45309", marginBottom: "0.55rem" }}>
          {avgDaysStr}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <button
          onClick={() => onPrompt("Which materials are critically low on stock?")}
          style={{
            background: "#DC2626",
            color: "#fff",
            border: "none",
            borderRadius: "7px",
            padding: "0.3rem 0.65rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Show Critical Items
        </button>
        <button
          onClick={() => onPrompt("Generate a reorder plan for all at-risk materials.")}
          style={{
            background: "#fff",
            color: "#92400E",
            border: "1px solid #FED7AA",
            borderRadius: "7px",
            padding: "0.3rem 0.65rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Generate Reorder Plan
        </button>
      </div>
    </div>
  );
};

/* ─── Mic Button ──────────────────────────────────────────────────────────── */
const MicButton = ({ isListening, onStart, onStop, disabled }) => {
  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!supported) return null;

  return (
    <button
      id="ai-voice-btn"
      onClick={isListening ? onStop : onStart}
      disabled={disabled}
      title={isListening ? "Stop listening" : "Speak your question"}
      style={{
        width: "34px",
        height: "34px",
        borderRadius: "10px",
        border: "none",
        background: isListening ? "#FEE2E2" : "#F3F4F6",
        color: isListening ? "#DC2626" : "#6B7280",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background 0.15s, color 0.15s",
        animation: isListening ? "micPulse 1.2s ease-in-out infinite" : "none",
        position: "relative",
      }}
    >
      {isListening ? (
        /* waveform / recording icon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8"  y1="23" x2="16" y2="23"/>
        </svg>
      ) : (
        /* microphone icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8"  y1="23" x2="16" y2="23"/>
        </svg>
      )}
    </button>
  );
};

/* ─── Main floating component ────────────────────────────────────────────── */
const AIAssistantFloat = () => {
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [isListening, setIsListening] = useState(false);

  /* Contextual alerts state */
  const [summary, setSummary]           = useState(null);
  const [criticalCount, setCriticalCount] = useState(0);

  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const recognitionRef  = useRef(null);

  /* ── Auto-scroll to bottom on new message ── */
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, open]);

  /* ── Focus input when panel opens ── */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  /* ── Fetch contextual alert data once on mount ── */
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [resSummary, resRisk] = await Promise.all([
          api.get("/analytics/summary/"),
          api.get("/analytics/risk-scores/"),
        ]);
        setSummary(resSummary.data);
        const critical = (resRisk.data || []).filter(r => r.risk_level === "CRITICAL").length;
        setCriticalCount(critical);
      } catch {
        /* silently fail — alerts are non-critical UX */
      }
    };
    fetchAlerts();
  }, []);

  /* ── Stop speech synthesis when closing ── */
  useEffect(() => {
    if (!open && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [open]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput("");
    setError(null);

    const userMsg = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      /* Build page_context from alert state */
      const pageContext = criticalCount > 0
        ? `criticalCount=${criticalCount}, highCount=${summary?.materials_at_risk ?? 0}`
        : "";

      const res = await api.post("/analytics/chat/", {
        message: msg,
        ...(pageContext && { page_context: pageContext }),
      });
      const aiMsg = {
        role:    "assistant",
        content: res.data.reply,
        sources: res.data.sources || [],
        model:   res.data.model,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errText =
        err.response?.data?.error ||
        "Unable to reach the AI service. Please try again.";
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  /* ── Voice STT ── */
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;   // show live transcript
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join("");
      /* Fill the input field — user presses Send themselves */
      setInput(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      /* Focus input so user can review and press Enter */
      setTimeout(() => inputRef.current?.focus(), 80);
    };

    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return (
    <>
      {/* ── Global keyframe styles ── */}
      <style>{`
        @keyframes aiDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes aiFadeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes aiButtonPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(123,31,31,0.4); }
          50%       { box-shadow: 0 4px 32px rgba(123,31,31,0.7); }
        }
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(220,38,38,0);  }
        }
        @keyframes badgePulse {
          0%, 100% { opacity: 1; transform: scale(1);    }
          50%       { opacity: 0.8; transform: scale(1.08); }
        }
        .ai-float-btn:hover {
          transform: scale(1.08) !important;
          box-shadow: 0 8px 28px rgba(123,31,31,0.55) !important;
        }
        .ai-send-btn:hover:not(:disabled) {
          background: ${BRAND_LT} !important;
        }
        .ai-suggestion:hover {
          background: ${BRAND}18 !important;
          border-color: ${BRAND}60 !important;
          color: ${BRAND} !important;
        }
        .ai-clear-btn:hover {
          color: #DC2626 !important;
        }
        #ai-voice-btn:hover:not(:disabled) {
          background: #FEE2E2 !important;
          color: #DC2626 !important;
        }
      `}</style>

      {/* ── Floating trigger button ── */}
      <button
        id="ai-assistant-float-btn"
        className="ai-float-btn"
        onClick={() => setOpen(v => !v)}
        title="CutWise AI Assistant"
        style={{
          position: "fixed",
          bottom: "28px",
          right: "28px",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_LT} 100%)`,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(123,31,31,0.4)",
          transition: "transform 0.18s ease, box-shadow 0.18s ease",
          animation: open ? "none" : "aiButtonPulse 3s ease-in-out infinite",
        }}
      >
        {open ? (
          /* Close icon */
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          /* Brain / AI icon */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a5 5 0 0 1 5 5c0 1-.2 1.9-.6 2.7A4 4 0 0 1 20 13a4 4 0 0 1-4 4h-.3A5 5 0 0 1 7 20a5 5 0 0 1-5-5 5 5 0 0 1 2.3-4.2A5 5 0 0 1 7 7a5 5 0 0 1 5-5z"/>
            <line x1="12" y1="9" x2="12" y2="15"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
          </svg>
        )}

        {/* ── Contextual Alert Badge (critical risk indicator) ── */}
        {!open && criticalCount > 0 && (
          <div style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: "#DC2626",
            color: "#fff",
            borderRadius: "99px",
            padding: "0.15rem 0.4rem",
            fontSize: "0.58rem",
            fontWeight: 800,
            whiteSpace: "nowrap",
            border: "2px solid #fff",
            lineHeight: 1.4,
            animation: "badgePulse 2s ease-in-out infinite",
            pointerEvents: "none",
          }}>
            ⚠ {criticalCount} Critical
          </div>
        )}

        {/* Green dot when closed & has prior messages (no critical risk) */}
        {!open && messages.length > 0 && criticalCount === 0 && (
          <span style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#10B981",
            border: "2px solid #fff",
          }} />
        )}
      </button>

      {/* ── Chat popup ── */}
      {open && (
        <div
          id="ai-assistant-popup"
          style={{
            position: "fixed",
            bottom: "96px",
            right: "28px",
            zIndex: 9998,
            width: "390px",
            maxWidth: "calc(100vw - 56px)",
            height: "560px",
            maxHeight: "calc(100vh - 120px)",
            background: "#fff",
            borderRadius: "20px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "aiFadeIn 0.22s ease",
            border: "1px solid #E5E7EB",
          }}
        >
          {/* ── Header ── */}
          <div style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_LT} 100%)`,
            padding: "1rem 1.1rem 0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexShrink: 0,
          }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a5 5 0 0 1 5 5c0 1-.2 1.9-.6 2.7A4 4 0 0 1 20 13a4 4 0 0 1-4 4h-.3A5 5 0 0 1 7 20a5 5 0 0 1-5-5 5 5 0 0 1 2.3-4.2A5 5 0 0 1 7 7a5 5 0 0 1 5-5z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>
                CutWise AI Assistant
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                Powered by Gemini Flash · RAG Pipeline
                {criticalCount > 0 && (
                  <span style={{
                    background: "rgba(220,38,38,0.25)",
                    border: "1px solid rgba(220,38,38,0.5)",
                    borderRadius: "99px",
                    padding: "0.05rem 0.4rem",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    color: "#FECACA",
                  }}>
                    ⚠ {criticalCount} CRITICAL
                  </span>
                )}
              </div>
            </div>
            {messages.length > 0 && (
              <button
                className="ai-clear-btn"
                onClick={clearChat}
                title="Clear conversation"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.3rem 0.5rem",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  transition: "color 0.15s",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* ── Messages area ── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem 0.9rem",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* ── Contextual Alert Card (shown when no messages yet & critical risk exists) ── */}
            {criticalCount > 0 && (
              <ContextualAlertCard
                summary={summary}
                criticalCount={criticalCount}
                onPrompt={(prompt) => sendMessage(prompt)}
              />
            )}

            {/* Empty state with suggestions */}
            {messages.length === 0 && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ textAlign: "center", padding: "0.5rem 0 0.75rem" }}>
                  <div style={{ fontSize: "2rem" }}>🧠</div>
                  <div style={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem", marginTop: "0.4rem" }}>
                    Ask about your inventory
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                    I have access to real-time stock, risk scores, and predictions.
                  </div>
                  {/* Voice hint */}
                  {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                    <div style={{ color: "#B45309", fontSize: "0.7rem", marginTop: "0.3rem", fontWeight: 500 }}>
                      🎙 You can also tap the mic to speak your question
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="ai-suggestion"
                      onClick={() => sendMessage(s)}
                      disabled={loading}
                      style={{
                        background: "#F9FAFB",
                        border: "1px solid #E5E7EB",
                        borderRadius: "10px",
                        padding: "0.55rem 0.85rem",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "0.78rem",
                        color: "#374151",
                        fontWeight: 500,
                        transition: "all 0.15s ease",
                        lineHeight: 1.4,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message thread */}
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

            {/* Typing indicator */}
            {loading && <TypingIndicator />}

            {/* Error message */}
            {error && (
              <div style={{
                padding: "0.6rem 0.85rem",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "10px",
                color: "#DC2626",
                fontSize: "0.78rem",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Listening indicator banner ── */}
          {isListening && (
            <div style={{
              padding: "0.45rem 0.9rem",
              background: "#FEF2F2",
              borderTop: "1px solid #FECACA",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "#DC2626",
              fontWeight: 600,
              flexShrink: 0,
            }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: "#DC2626",
                animation: "micPulse 1s ease-in-out infinite",
                flexShrink: 0,
              }} />
              Listening… speak your question, then press Send ↵
            </div>
          )}

          {/* ── Input bar ── */}
          <div style={{
            padding: "0.75rem 0.9rem",
            borderTop: "1px solid #F3F4F6",
            background: "#FAFAFA",
            flexShrink: 0,
          }}>
            <div style={{
              display: "flex",
              gap: "0.4rem",
              alignItems: "flex-end",
              background: "#fff",
              border: `1.5px solid ${isListening ? "#DC2626" : "#E5E7EB"}`,
              borderRadius: "14px",
              padding: "0.45rem 0.5rem 0.45rem 0.9rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              transition: "border-color 0.15s",
            }}>
              <textarea
                ref={inputRef}
                id="ai-chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening… your words will appear here" : "Ask about inventory, risk, or reorders…"}
                rows={1}
                disabled={loading}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "0.82rem",
                  color: "#111827",
                  resize: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  maxHeight: "80px",
                  overflowY: "auto",
                }}
              />

              {/* Mic button */}
              <MicButton
                isListening={isListening}
                onStart={startListening}
                onStop={stopListening}
                disabled={loading}
              />

              {/* Send button */}
              <button
                className="ai-send-btn"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                title="Send (Enter)"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  border: "none",
                  background: loading || !input.trim() ? "#E5E7EB" : BRAND,
                  color: loading || !input.trim() ? "#9CA3AF" : "#fff",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }}
              >
                {loading ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: "aiDot 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>
            <div style={{
              textAlign: "center",
              fontSize: "0.62rem",
              color: "#D1D5DB",
              marginTop: "0.4rem",
            }}>
              Enter to send · 🎙 Mic to speak · AI responses are based on current inventory data
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistantFloat;
