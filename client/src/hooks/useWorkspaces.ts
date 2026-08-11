import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@/types";
import { apiRequest } from "@/lib/api";

const ACTIVE_KEY = "devpulse:activeWorkspace";

export function useWorkspaces(enabled: boolean) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(localStorage.getItem(ACTIVE_KEY));
  const [loading, setLoading] = useState(true);

  // Nota: `load` NO depende de `activeId`. Si dependiera de él, cada
  // `setActiveId` dentro de `load` recrearía la función y dispararía el
  // useEffect de nuevo, y si el id guardado en localStorage no coincidía
  // con ningún workspace real, el loading se quedaba colgado para siempre.
  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ workspaces: Workspace[] }>("/workspaces");
      setWorkspaces(data.workspaces);

      setActiveId((current) => {
        const currentIsValid = current && data.workspaces.some((w) => w.id === current);
        if (currentIsValid) return current;

        // El id guardado ya no existe (workspace eliminado, otra cuenta, etc.)
        // o nunca hubo uno: cae al primer workspace disponible.
        const fallback = data.workspaces[0]?.id ?? null;
        if (fallback) localStorage.setItem(ACTIVE_KEY, fallback);
        else localStorage.removeItem(ACTIVE_KEY);
        return fallback;
      });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  function selectWorkspace(id: string) {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  const active = workspaces.find((w) => w.id === activeId) || null;

  return { workspaces, active, activeId, selectWorkspace, loading, refresh: load };
}
