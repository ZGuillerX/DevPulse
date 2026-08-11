import { randomUUID } from "crypto";
import { query } from "../config/db.js";

export async function addRepository({ workspaceId, repoData }) {
  const id = randomUUID();
  await query(
    `INSERT INTO repositories
      (id, workspace_id, github_repo_id, full_name, owner, name, description,
       default_branch, is_private, stars, open_issues_count, pushed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE description = VALUES(description), stars = VALUES(stars)`,
    [
      id,
      workspaceId,
      repoData.githubRepoId,
      repoData.fullName,
      repoData.owner,
      repoData.name,
      repoData.description,
      repoData.defaultBranch,
      repoData.isPrivate,
      repoData.stars,
      repoData.openIssuesCount,
      repoData.pushedAt ? new Date(repoData.pushedAt) : null,
    ]
  );
  const rows = await query("SELECT id FROM repositories WHERE workspace_id = ? AND github_repo_id = ?", [
    workspaceId,
    repoData.githubRepoId,
  ]);
  return rows[0].id;
}

// Punto 15: paginación real, no traer todo de golpe
export async function listRepositories(workspaceId, { page = 1, limit = 20, search = "", statusFilter = "all" } = {}) {
  const offset = (page - 1) * limit;

  const params = [workspaceId];
  let where = "r.workspace_id = ?";
  if (search) {
    where += " AND r.full_name LIKE ?";
    params.push(`%${search}%`);
  }

  const countRows = await query(`SELECT COUNT(*) as total FROM repositories r WHERE ${where}`, params);
  const total = countRows[0].total;

  const rows = await query(
    `SELECT r.*,
       (SELECT hs.score FROM health_snapshots hs WHERE hs.repository_id = r.id ORDER BY hs.captured_at DESC LIMIT 1) as latest_health_score
     FROM repositories r
     WHERE ${where}
     ORDER BY r.added_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => healthStatus(r.latest_health_score) === statusFilter);

  return {
    items: filtered,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function healthStatus(score) {
  if (score === null || score === undefined) return "unknown";
  if (score >= 80) return "healthy";
  if (score >= 60) return "warning";
  return "critical";
}

export async function getRepositoryById(id) {
  const rows = await query("SELECT * FROM repositories WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function listPullRequests(repositoryId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const countRows = await query(
    "SELECT COUNT(*) as total FROM pull_requests WHERE repository_id = ? AND state = 'open'",
    [repositoryId]
  );
  const rows = await query(
    `SELECT * FROM pull_requests WHERE repository_id = ? AND state = 'open'
     ORDER BY FIELD(derived_status, 'checks_failing','changes_requested','stale','unknown','clean'), github_updated_at DESC
     LIMIT ? OFFSET ?`,
    [repositoryId, limit, offset]
  );
  return { items: rows, pagination: { page, limit, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / limit) } };
}

export async function listIssues(repositoryId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const countRows = await query(
    "SELECT COUNT(*) as total FROM issues WHERE repository_id = ? AND state = 'open'",
    [repositoryId]
  );
  const rows = await query(
    `SELECT * FROM issues WHERE repository_id = ? AND state = 'open'
     ORDER BY has_assignee ASC, github_updated_at ASC
     LIMIT ? OFFSET ?`,
    [repositoryId, limit, offset]
  );
  return { items: rows, pagination: { page, limit, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / limit) } };
}

export async function getLatestHealthSnapshot(repositoryId) {
  const rows = await query(
    "SELECT * FROM health_snapshots WHERE repository_id = ? ORDER BY captured_at DESC LIMIT 1",
    [repositoryId]
  );
  return rows[0] || null;
}

// Punto 12: histórico para gráficas de tendencia
export async function getHealthHistory(repositoryId, days = 30) {
  return query(
    `SELECT score, captured_at FROM health_snapshots
     WHERE repository_id = ? AND captured_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY captured_at ASC`,
    [repositoryId, days]
  );
}

export async function deleteRepository(id) {
  await query("DELETE FROM repositories WHERE id = ?", [id]);
}
