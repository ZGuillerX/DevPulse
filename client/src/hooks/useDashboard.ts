import { useCallback, useEffect, useState } from "react";
import type { DashboardData } from "@/types";
import { apiRequest, getPreferredAiProvider } from "@/lib/api";

export function useDashboard(workspaceId: string | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getPreferredAiProvider();
      const result = await apiRequest<DashboardData>(
        `/workspaces/${workspaceId}/dashboard?aiProvider=${encodeURIComponent(provider)}`
      );
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
