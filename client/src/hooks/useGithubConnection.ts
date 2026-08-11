import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

interface GithubStatus {
  connected: boolean;
  githubUsername: string | null;
}

export function useGithubConnection(enabled: boolean) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<GithubStatus>("/users/github/status");
      setStatus(data);
    } catch {
      setStatus({ connected: false, githubUsername: null });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect(token: string) {
    setError(null);
    try {
      const data = await apiRequest<{ githubUsername: string }>("/users/github/connect", {
        method: "POST",
        body: { token },
      });
      setStatus({ connected: true, githubUsername: data.githubUsername });
      localStorage.removeItem("devpulse:skippedGithubConnect");
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  }

  async function disconnect() {
    await apiRequest("/users/github/disconnect", { method: "POST" });
    setStatus({ connected: false, githubUsername: null });
  }

  return { status, loading, error, connect, disconnect, refresh };
}
