import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Workspace } from "@/types";
import { useRepositoryDetail } from "@/hooks/useRepositoryDetail";
import HealthScoreCard from "@/components/HealthScoreCard";
import HealthHistoryChart from "@/components/HealthHistoryChart";
import PullRequestBoard from "@/components/PullRequestBoard";
import IssueBoard from "@/components/IssueBoard";
import "./RepositoryPage.css";

interface Props {
  workspace: Workspace | null;
}

export default function RepositoryPage({ workspace }: Props) {
  const { repositoryId } = useParams();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const { detail, pullRequests, issues, history, loading, error, triggerSync } = useRepositoryDetail(
    workspace?.id ?? null,
    repositoryId ?? null
  );

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerSync();
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="repo-page">
        <p style={{ color: "var(--color-muted)" }}>Cargando repositorio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="repo-page">
        <button className="repo-page-back" onClick={() => navigate("/")}>
          ← Volver
        </button>
        <p style={{ color: "var(--color-danger)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="repo-page">
      <button className="repo-page-back" onClick={() => navigate("/")}>
        ← Volver al dashboard
      </button>

      <div className="repo-page-header">
        <div>
          <h1 className="repo-page-title">{detail?.repo?.full_name}</h1>
          {detail?.repo?.description && <p className="repo-page-desc">{detail.repo.description}</p>}
        </div>
        <button className="repo-page-sync-btn" onClick={handleSync} disabled={syncing}>
          {syncing ? "Sincronizando..." : "↻ Sync now"}
        </button>
      </div>

      <div className="repo-page-top-grid">
        <HealthScoreCard health={detail?.health ?? null} />
        <HealthHistoryChart history={history} />
      </div>

      <div className="repo-page-boards">
        <PullRequestBoard pullRequests={pullRequests} />
        <IssueBoard issues={issues} />
      </div>
    </div>
  );
}
