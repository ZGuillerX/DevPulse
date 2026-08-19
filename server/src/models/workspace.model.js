import { randomUUID } from "crypto";
import { query } from "../config/db.js";

export async function createWorkspace({ name, ownerId }) {
  const id = randomUUID();
  await query("INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)", [id, name, ownerId]);
  await query(
    "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
    [randomUUID(), id, ownerId]
  );
  return { id, name, ownerId };
}

export async function getMemberRole(workspaceId, userId) {
  const rows = await query("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?", [
    workspaceId,
    userId,
  ]);
  return rows[0]?.role ?? null;
}

export async function countOwners(workspaceId) {
  const rows = await query(
    "SELECT COUNT(*) as total FROM workspace_members WHERE workspace_id = ? AND role = 'owner'",
    [workspaceId]
  );
  return rows[0].total;
}

export async function listUserWorkspaces(userId) {
  return query(
    `SELECT w.id, w.name, wm.role
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = ?
     ORDER BY w.created_at ASC`,
    [userId]
  );
}

export async function addMember({ workspaceId, userId, role = "member" }) {
  await query(
    `INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [randomUUID(), workspaceId, userId, role]
  );
}

export async function listMembers(workspaceId) {
  return query(
    `SELECT u.id, u.email, u.name, u.avatar_url, wm.role, wm.invited_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?`,
    [workspaceId]
  );
}

export async function updateMemberRole({ workspaceId, userId, role }) {
  await query("UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?", [
    role,
    workspaceId,
    userId,
  ]);
}

export async function removeMember({ workspaceId, userId }) {
  await query("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?", [workspaceId, userId]);
}
