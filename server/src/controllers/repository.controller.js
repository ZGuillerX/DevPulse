import { AppError } from "../middleware/errorHandler.js";
import * as RepoModel from "../models/repository.model.js";
import * as UserModel from "../models/user.model.js";
import { query } from "../config/db.js";
import { decrypt } from "../utils/crypto.js";
import { fetchRepo, validateGitHubToken } from "../services/github.service.js";
import { syncRepository } from "../services/sync.service.js";
import { cacheWrap, invalidateWorkspaceCaches } from "../services/cache.service.js";
import { config } from "../config/env.js";
import { logAudit } from "./auth.controller.js";

async function getDecryptedGithubToken(userId) {
  const rows = await query("SELECT github_access_token_encrypted FROM users WHERE id = ?", [userId]);
  const encrypted = rows[0]?.github_access_token_encrypted;
  if (!encrypted) {
    throw new AppError(
      "No tienes GitHub conectado. Ve a Configuración y pega tu Personal Access Token.",
      400,
      "NO_GITHUB_TOKEN"
    );
  }
  try {
    return decrypt(encrypted);
  } catch (err) {
    // El token guardado no se puede desencriptar con la ENCRYPTION_KEY actual
    // (p. ej. la clave del servidor cambió). Sin este catch, el error crudo de
    // crypto sube como 500 genérico y el usuario nunca sabe que debe reconectar.
    throw new AppError(
      "Tu conexión con GitHub ya no es válida. Ve a Configuración y vuelve a pegar tu Personal Access Token.",
      400,
      "GITHUB_TOKEN_INVALID"
    );
  }
}

export async function addRepository(req, res, next) {
  try {
    const { fullName } = req.body;
    const { workspaceId } = req.params;

    const token = await getDecryptedGithubToken(req.user.id);
    const repoData = await fetchRepo(token, fullName);
    const repositoryId = await RepoModel.addRepository({ workspaceId, repoData });

    await syncRepository(repositoryId, token, fullName, workspaceId);
    await invalidateWorkspaceCaches(workspaceId);
    await logAudit({ userId: req.user.id, workspaceId, action: "repo.added", req, metadata: { fullName } });

    req.log.info("Repositorio agregado y sincronizado", { repositoryId, fullName });
    res.status(201).json({ repositoryId });
  } catch (err) {
    next(err);
  }
}

export async function listRepositories(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const { page = 1, limit = 20, search = "", status = "all" } = req.query;

    const cacheKey = `repos:${workspaceId}:${page}:${limit}:${search}:${status}`;
    const result = await cacheWrap(cacheKey, config.cache.ttlSeconds, () =>
      RepoModel.listRepositories(workspaceId, { page: Number(page), limit: Number(limit), search, statusFilter: status })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getRepository(req, res, next) {
  try {
    const repo = await RepoModel.getRepositoryById(req.params.repositoryId);
    if (!repo) throw new AppError("Repositorio no encontrado.", 404, "REPO_NOT_FOUND");

    const health = await RepoModel.getLatestHealthSnapshot(repo.id);
    res.json({ repo, health });
  } catch (err) {
    next(err);
  }
}

export async function listPullRequests(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await RepoModel.listPullRequests(req.params.repositoryId, { page: Number(page), limit: Number(limit) });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listIssues(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await RepoModel.listIssues(req.params.repositoryId, { page: Number(page), limit: Number(limit) });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getHealthHistory(req, res, next) {
  try {
    const days = Number(req.query.days || 30);
    const history = await RepoModel.getHealthHistory(req.params.repositoryId, days);
    res.json({ history });
  } catch (err) {
    next(err);
  }
}

// Botón "Sync now" del punto 4
export async function triggerSync(req, res, next) {
  try {
    const repo = await RepoModel.getRepositoryById(req.params.repositoryId);
    if (!repo) throw new AppError("Repositorio no encontrado.", 404, "REPO_NOT_FOUND");

    const token = await getDecryptedGithubToken(req.user.id);
    const result = await syncRepository(repo.id, token, repo.full_name, repo.workspace_id);

    await invalidateWorkspaceCaches(repo.workspace_id);
    req.log.info("Sincronización manual disparada", { repositoryId: repo.id });

    res.json({ message: "Sincronización completada.", ...result });
  } catch (err) {
    next(err);
  }
}

export async function removeRepository(req, res, next) {
  try {
    await RepoModel.deleteRepository(req.params.repositoryId);
    await invalidateWorkspaceCaches(req.params.workspaceId);
    req.log.info("Repositorio eliminado", { repositoryId: req.params.repositoryId });
    res.json({ message: "Repositorio eliminado." });
  } catch (err) {
    next(err);
  }
}
