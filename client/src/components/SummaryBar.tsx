import type { DashboardSummary } from "@/types";
import "./SummaryBar.css";

interface Props {
  summary: DashboardSummary;
}

export default function SummaryBar({ summary }: Props) {
  return (
    <div className="summary-bar">
      <div className="summary-cell">
        <p className="summary-cell-label">Repositorios</p>
        <p className="summary-cell-value">{summary.totalRepos}</p>
      </div>
      <div className="summary-cell">
        <p className="summary-cell-label">PRs abiertos</p>
        <p className="summary-cell-value">{summary.openPRs}</p>
      </div>
      <div className="summary-cell">
        <p className="summary-cell-label">Issues abiertos</p>
        <p className="summary-cell-value">{summary.openIssues}</p>
      </div>
      <div className="summary-cell">
        <p className="summary-cell-label">CI fallando</p>
        <p className={`summary-cell-value ${summary.failingCI > 0 ? "summary-cell-value--danger" : ""}`}>
          {summary.failingCI}
        </p>
      </div>
      <div className="summary-cell">
        <p className="summary-cell-label">Salud promedio</p>
        <p className="summary-cell-value summary-cell-value--signal">
          {summary.avgHealth !== null ? summary.avgHealth : "—"}
        </p>
      </div>
    </div>
  );
}
