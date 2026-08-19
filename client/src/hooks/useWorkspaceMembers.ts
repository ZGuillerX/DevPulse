import { useCallback, useEffect, useState } from "react";
import type { Member, Role } from "@/types";
import { apiRequest } from "@/lib/api";

export function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ members: Member[] }>(`/workspaces/${workspaceId}/members`);
      setMembers(data.members);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function inviteMember(email: string, role: Role) {
    if (!workspaceId) return;
    await apiRequest(`/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: { email, role },
    });
    await load();
  }

  async function updateRole(userId: string, role: Role) {
    if (!workspaceId) return;
    await apiRequest(`/workspaces/${workspaceId}/members/${userId}`, {
      method: "PATCH",
      body: { role },
    });
    await load();
  }

  async function removeMember(userId: string) {
    if (!workspaceId) return;
    await apiRequest(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });
    await load();
  }

  return { members, loading, error, inviteMember, updateRole, removeMember };
}
