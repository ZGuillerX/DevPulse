import { useCallback, useEffect, useState } from "react";
import type { AlertSettings } from "@/types";
import { apiRequest } from "@/lib/api";

const DEFAULTS: AlertSettings = {
  ci_failure: true,
  pr_waiting_days: 3,
  issue_inactive_days: 14,
  health_score_threshold: 60,
  email_enabled: false,
};

export function useAlertSettings(workspaceId: string | null) {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ settings: AlertSettings }>(`/workspaces/${workspaceId}/alert-settings`);
      setSettings(data.settings);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(next: AlertSettings) {
    if (!workspaceId) return;
    const data = await apiRequest<{ settings: AlertSettings }>(`/workspaces/${workspaceId}/alert-settings`, {
      method: "PATCH",
      body: {
        ciFailure: next.ci_failure,
        prWaitingDays: next.pr_waiting_days,
        issueInactiveDays: next.issue_inactive_days,
        healthScoreThreshold: next.health_score_threshold,
        emailEnabled: next.email_enabled,
      },
    });
    setSettings(data.settings);
  }

  return { settings, loading, error, save };
}
