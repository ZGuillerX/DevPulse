import { randomUUID } from "crypto";
import { query } from "../config/db.js";

export async function createUser({ email, passwordHash, name }) {
  const id = randomUUID();
  await query(
    `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`,
    [id, email, passwordHash, name]
  );
  return { id, email, name };
}

export async function findUserByEmail(email) {
  const rows = await query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const rows = await query("SELECT id, email, name, avatar_url, github_username FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function findUserByGithubId(githubId) {
  const rows = await query("SELECT * FROM users WHERE github_id = ?", [githubId]);
  return rows[0] || null;
}

export async function upsertGithubUser({ githubId, githubUsername, email, name, avatarUrl, encryptedToken }) {
  const existing = await findUserByGithubId(githubId);
  if (existing) {
    await query(
      `UPDATE users SET github_username = ?, avatar_url = ?, github_access_token_encrypted = ? WHERE id = ?`,
      [githubUsername, avatarUrl, encryptedToken, existing.id]
    );
    return { id: existing.id, email: existing.email, name: existing.name };
  }

  const id = randomUUID();
  await query(
    `INSERT INTO users (id, email, name, avatar_url, github_id, github_username, github_access_token_encrypted)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, email, name, avatarUrl, githubId, githubUsername, encryptedToken]
  );
  return { id, email, name };
}

// Guarda un Personal Access Token pegado manualmente desde la UI, después
// del login normal — no requiere pasar por el flujo OAuth de GitHub.
export async function saveGithubToken({ userId, githubId, githubUsername, avatarUrl, encryptedToken }) {
  await query(
    `UPDATE users SET github_id = ?, github_username = ?, avatar_url = ?, github_access_token_encrypted = ? WHERE id = ?`,
    [githubId, githubUsername, avatarUrl, encryptedToken, userId]
  );
}

export async function disconnectGithub(userId) {
  await query(
    `UPDATE users SET github_access_token_encrypted = NULL, github_id = NULL, github_username = NULL WHERE id = ?`,
    [userId]
  );
}

export async function getGithubConnectionStatus(userId) {
  const rows = await query(
    "SELECT github_username, github_access_token_encrypted IS NOT NULL as connected FROM users WHERE id = ?",
    [userId]
  );
  if (rows.length === 0) return { connected: false, githubUsername: null };
  return { connected: Boolean(rows[0].connected), githubUsername: rows[0].github_username };
}
