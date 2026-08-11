import type { HealthSnapshot } from "@/types";
import "./HealthScoreCard.css";

interface Props {
  health: HealthSnapshot | null;
}

const STATUS_LABEL: Record<string, string> = {
  healthy: "Saludable",
  warning: "Atención",
  critical: "Crítico",
  unknown: "Sin datos",
};

const STATUS_COLOR: Record<string, string> = {
  healthy: "var(--color-signal)",
  warning: "var(--color-warn)",
  critical: "var(--color-danger)",
  unknown: "var(--color-muted)",
};

export default function HealthScoreCard({ health }: Props) {
  if (!health) {
    return (
      <div className="health-card">
        <p className="health-card-label">Health Score</p>
        <p className="health-card-score" style={{ color: "var(--color-muted)" }}>
          —
        </p>
        <p className="health-factor-text">Sincroniza el repo para calcular su salud.</p>
      </div>
    );
  }

  const color = STATUS_COLOR[health.status];

  return (
    <div className="health-card">
      <div className="health-card-header">
        <span className="health-card-label">Health Score</span>
        <span className={`health-card-badge health-card-badge--${health.status}`}>
          {STATUS_LABEL[health.status]}
        </span>
      </div>

      <div className="health-card-score" style={{ color }}>
        {health.score}
        <span style={{ fontSize: 18, color: "var(--color-muted)" }}> / 100</span>
      </div>

      <div className="health-card-bar-track">
        <div
          className="health-card-bar-fill"
          style={{ width: `${health.score}%`, background: color }}
        />
      </div>

      <div className="health-card-breakdown">
        {health.breakdown.map((factor, i) => (
          <div key={i} className="health-factor">
            <span
              className={`health-factor-points ${
                factor.points >= 0 ? "health-factor-points--positive" : "health-factor-points--negative"
              }`}
            >
              {factor.points > 0 ? "+" : ""}
              {factor.points}
            </span>
            <span className="health-factor-text">
              <span className="health-factor-name">{factor.factor}.</span> {factor.reason}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
