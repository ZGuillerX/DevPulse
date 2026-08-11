import type { DailyBrief, PriorityItem } from "@/types";
import "./PulseHeader.css";

interface Props {
  brief: DailyBrief | null;
  priorityItems: PriorityItem[];
  loading: boolean;
  onRefresh: () => void;
}

export default function PulseHeader({ brief, priorityItems, loading, onRefresh }: Props) {
  return (
    <div className="pulse">
      <div className="pulse-top">
        <div className="pulse-top-row">
          <div className="pulse-eyebrow">
            <span className="pulse-dot-status" />
            <span className="pulse-eyebrow-text">Pulso de hoy</span>
          </div>
          <button className="pulse-refresh" onClick={onRefresh} disabled={loading}>
            {loading ? "Actualizando..." : "↻ Actualizar"}
          </button>
        </div>

        {loading && !brief && (
          <div className="pulse-skeleton">
            <div className="pulse-skeleton-line" style={{ width: "60%", height: 28 }} />
            <div className="pulse-skeleton-line" style={{ width: "90%" }} />
            <div className="pulse-skeleton-line" style={{ width: "75%" }} />
          </div>
        )}

        {brief && (
          <>
            <p className="pulse-summary">{brief.brief}</p>
            {brief.isFallback && (
              <p className="pulse-fallback-note">
                ⚠ Resumen generado con reglas automáticas — agrega una clave de IA en Configuración para un análisis más profundo.
              </p>
            )}
          </>
        )}
      </div>

      {priorityItems.length > 0 && (
        <div className="pulse-items">
          {priorityItems.map((item, i) => (
            <a
              key={`${item.refId}-${i}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="pulse-item"
            >
              <span className={`pulse-item-dot pulse-item-dot--${item.urgency}`} />
              <div className="pulse-item-body">
                <p className="pulse-item-title">{item.title}</p>
                <p className="pulse-item-reason">{item.reason}</p>
              </div>
              <span className="pulse-item-repo">{item.repo.split("/")[1]}</span>
            </a>
          ))}
        </div>
      )}

      {!loading && priorityItems.length === 0 && (
        <div className="pulse-empty">Nada urgente ahora mismo. Buen momento para avanzar en lo tuyo.</div>
      )}
    </div>
  );
}
