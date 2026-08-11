import { useCallback, useEffect, useState } from "react";
import type { HealthSnapshot, Paginated, PullRequest, Issue } from "@/types";
import { apiRequest } from "@/lib/api";

interface RepoDetail {
  repo: any;
  health: HealthSnapshot | null;
}

export function useRepositoryDetail(workspaceId: string | null, repositoryId: string | null) {
  const [detail, setDetail] = useState<RepoDetail | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [history, setHistory] = useState<{ score: number; captured_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !repositoryId) return;
    setLoading(true);
    setError(null);
    try {
      const base = `/workspaces/${workspaceId}/repositories/${repositoryId}`;
      const [detailData, prsData, issuesData, historyData] = await Promise.all([
        apiRequest<RepoDetail>(base),
        apiRequest<Paginated<PullRequest>>(`${base}/pull-requests?limit=50`),
        apiRequest<Paginated<Issue>>(`${base}/issues?limit=50`),
        apiRequest<{ history: { score: number; captured_at: string }[] }>(`${base}/health-history`),
      ]);
      setDetail(detailData);
      setPullRequests(prsData.items);
      setIssues(issuesData.items);
      setHistory(historyData.history);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repositoryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function triggerSync() {
    if (!workspaceId || !repositoryId) return;
    await apiRequest(`/workspaces/${workspaceId}/repositories/${repositoryId}/sync`, { method: "POST" });
    await load();
  }

  return { detail, pullRequests, issues, history, loading, error, refresh: load, triggerSync };
}
