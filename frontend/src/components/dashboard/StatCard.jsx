/**
 * StatCard – A reusable dashboard stat card component.
 *
 * Props:
 *  - label   (string)   Card title text
 *  - value   (string)   Primary metric value
 *  - icon    (node)     SVG or React node for the header icon
 *  - variant (string)   Optional CSS modifier class (e.g. "alert")
 *  - sub     (node)     Optional sub-line content (string or JSX)
 *  - subClassName (string) Optional extra class for the sub-line (e.g. "warning")
 */

/* ── Single stat card ────────────────────────── */

export const StatCard = ({
  label,
  value,
  icon,
  variant,
  sub,
  subClassName,
}) => {
  const cardClass = ["stat-card", variant].filter(Boolean).join(" ");
  const subClass = ["stat-card-sub", subClassName].filter(Boolean).join(" ");

  return (
    <div className={cardClass}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className={subClass}>{sub}</div>}
    </div>
  );
};

/* ── Grid wrapper (optional convenience) ─────── */

export const StatCards = ({ children }) => (
  <div className="stat-cards">{children}</div>
);

export default StatCard;
