import type { Issue } from "@/types";
import "./Board.css";

interface Props {
  issues: Issue[];
}

function daysOpen(dateIso: string): number {
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
}

function isStale(dateIso: string): boolean {
  return daysOpen(dateIso) >= 14;
}

export default function IssueBoard({ issues }: Props) {
  if (issues.length === 0) {
    return (
      <div className="board-card">
        <div className="board-header">
          <span className="board-title">Issues</span>
        </div>
        <div className="board-empty">No hay issues abiertos.</div>
      </div>
    );
  }

  const sorted = [...issues].sort((a, b) => {
    if (a.has_assignee !== b.has_assignee) return a.has_assignee ? 1 : -1;
    return daysOpen(b.github_created_at) - daysOpen(a.github_created_at);
  });

  return (
    <div className="board-card">
      <div className="board-header">
        <span className="board-title">Issues</span>
        <span className="board-count">{issues.length} abiertos</span>
      </div>
      <div className="board-rows">
        {sorted.map((issue) => (
          <a key={issue.id} href={issue.url} target="_blank" rel="noreferrer" className="board-row">
            <span
              className={`board-row-dot ${
                !issue.has_assignee ? "board-row-dot--warn" : isStale(issue.github_updated_at) ? "board-row-dot--muted" : "board-row-dot--signal"
              }`}
            />
            <div className="board-row-body">
              <p className="board-row-title">{issue.title}</p>
              <p className="board-row-meta">
                {daysOpen(issue.github_created_at)}d abierto{!issue.has_assignee && " · sin asignar"}
              </p>
            </div>
            {issue.labels.slice(0, 2).map((label) => (
              <span key={label} className="board-label">
                {label}
              </span>
            ))}
          </a>
        ))}
      </div>
    </div>
  );
}
