import "./HealthHistoryChart.css";

interface Point {
  score: number;
  captured_at: string;
}

interface Props {
  history: Point[];
}

export default function HealthHistoryChart({ history }: Props) {
  if (history.length < 2) {
    return (
      <div className="history-card">
        <p className="history-card-label">Tendencia (30 días)</p>
        <div className="history-empty">Aún no hay suficiente historial para graficar una tendencia.</div>
      </div>
    );
  }

  const width = 600;
  const height = 120;
  const padding = 10;

  const scores = history.map((h) => h.score);
  const max = Math.max(...scores, 100);
  const min = Math.min(...scores, 0);
  const range = max - min || 1;

  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - padding * 2);
    const y = height - padding - ((h.score - min) / range) * (height - padding * 2);
    return { x, y, score: h.score };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const first = scores[0];
  const last = scores[scores.length - 1];
  const change = last - first;
  const changePercent = first > 0 ? Math.round((change / first) * 100) : 0;
  const trendClass = change > 2 ? "up" : change < -2 ? "down" : "flat";

  return (
    <div className="history-card">
      <p className="history-card-label">Tendencia (30 días)</p>
      <svg className="history-chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="var(--color-signal)" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--color-signal)" />
        ))}
      </svg>
      <p className={`history-trend history-trend--${trendClass}`}>
        {change > 0 ? "↑" : change < 0 ? "↓" : "→"} Salud {change >= 0 ? "subió" : "bajó"}{" "}
        {Math.abs(changePercent)}% en este periodo.
      </p>
    </div>
  );
}
