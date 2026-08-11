import { useCallback, useEffect, useState } from "react";
import type { Paginated, Repository } from "@/types";
import { apiRequest } from "@/lib/api";

export function useRepositories(workspaceId: string | null) {
  const [items, setItems] = useState<Repository[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (page = 1) => {
      if (!workspaceId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20", search, status });
        const result = await apiRequest<Paginated<Repository>>(
          `/workspaces/${workspaceId}/repositories?${params.toString()}`
        );
        setItems(result.items);
        setPagination(result.pagination);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, search, status]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  async function addRepository(fullName: string) {
    if (!workspaceId) return;
    await apiRequest(`/workspaces/${workspaceId}/repositories`, {
      method: "POST",
      body: { fullName },
    });
    await load(1);
  }

  async function syncRepository(repositoryId: string) {
    if (!workspaceId) return;
    await apiRequest(`/workspaces/${workspaceId}/repositories/${repositoryId}/sync`, { method: "POST" });
    await load(pagination.page);
  }

  return {
    items,
    pagination,
    search,
    setSearch,
    status,
    setStatus,
    loading,
    error,
    goToPage: load,
    addRepository,
    syncRepository,
  };
}
