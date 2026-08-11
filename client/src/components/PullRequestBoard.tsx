import type { PullRequest } from "@/types";
import "./Board.css";

interface Props {
  pullRequests: PullRequest[];
}

const STATUS_LABEL: Record<string, string> = {
  checks_failing: "CI fallando",
  changes_requested: "Cambios solicitados",
  stale: "Sin actividad",
  clean: "Al día",
  unknown: "Sin datos",
};

const CI_ICON: Record<string, string> = {
  success: "✓",
  failure: "✕",
  pending: "◐",
  unknown: "–",
};

function daysOpen(dateIso: string): number {
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
}

const ORDER = ["checks_failing", "changes_requested", "stale", "unknown", "clean"];

export default function PullRequestBoard({ pullRequests }: Props) {
  if (pullRequests.length === 0) {
    return (
      <div className="board-card">
        <div className="board-header">
          <span className="board-title">Pull Requests</span>
        </div>
        <div className="board-empty">No hay pull requests abiertos.</div>
      </div>
    );
  }

  const sorted = [...pullRequests].sort(
    (a, b) => ORDER.indexOf(a.derived_status) - ORDER.indexOf(b.derived_status)
  );

  return (
    <div className="board-card">
      <div className="board-header">
        <span className="board-title">Pull Requests</span>
        <span className="board-count">{pullRequests.length} abiertos</span>
      </div>
      <div className="board-rows">
        {sorted.map((pr) => (
          <a key={pr.id} href={pr.url} target="_blank" rel="noreferrer" className="board-row">
            <span className={`board-row-icon board-row-icon--${pr.ci_status}`}>{CI_ICON[pr.ci_status]}</span>
            <div className="board-row-body">
              <p className="board-row-title">
                {pr.is_draft && "[draft] "}
                {pr.title}
              </p>
              <p className="board-row-meta">
                @{pr.author} · {daysOpen(pr.github_created_at)}d abierto
              </p>
            </div>
            <span className={`board-status-pill board-status-pill--${pr.derived_status}`}>
              {STATUS_LABEL[pr.derived_status]}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
