import fetch from "node-fetch";
import { logger } from "../utils/logger.js";
import { AppError } from "../middleware/errorHandler.js";

const API_BASE = "https://api.github.com";

// Estado del rate limit de GitHub, expuesto para que el frontend pueda
// mostrarlo (punto 14) y para que el propio servicio se frene si es necesario.
let lastKnownRateLimit = { remaining: null, resetAt: null };

export function getGitHubRateLimitStatus() {
  return lastKnownRateLimit;
}

async function ghFetch(token, path) {
  if (lastKnownRateLimit.remaining === 0 && lastKnownRateLimit.resetAt > Date.now()) {
    const waitSeconds = Math.ceil((lastKnownRateLimit.resetAt - Date.now()) / 1000);
    logger.warn("Bloqueando llamada a GitHub por rate limit local", { waitSeconds });
    throw new AppError(
      `Límite de GitHub alcanzado. Intenta de nuevo en ${waitSeconds}s.`,
      429,
      "GITHUB_RATE_LIMITED"
    );
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (remaining !== null) {
    lastKnownRateLimit = {
      remaining: Number(remaining),
      resetAt: reset ? Number(reset) * 1000 : null,
    };
    if (Number(remaining) < 50) {
      logger.warn("Rate limit de GitHub bajo", { remaining, path });
    }
  }

  if (res.status === 401) throw new AppError("Token de GitHub inválido o expirado.", 401, "GITHUB_UNAUTHORIZED");
  if (res.status === 403) throw new AppError("Acceso denegado por GitHub (permisos o rate limit).", 403, "GITHUB_FORBIDDEN");
  if (res.status === 404) throw new AppError(`Recurso no encontrado en GitHub: ${path}`, 404, "GITHUB_NOT_FOUND");
  if (!res.ok) throw new AppError(`Error de GitHub API (${res.status})`, 502, "GITHUB_ERROR");

  return res.json();
}

export async function fetchRepo(token, fullName) {
  const data = await ghFetch(token, `/repos/${fullName}`);
  return {
    githubRepoId: data.id,
    fullName: data.full_name,
    owner: data.owner.login,
    name: data.name,
    description: data.description,
    defaultBranch: data.default_branch,
    isPrivate: data.private,
    stars: data.stargazers_count,
    openIssuesCount: data.open_issues_count,
    pushedAt: data.pushed_at,
  };
}

export async function fetchPullRequests(token, fullName) {
  const prs = await ghFetch(token, `/repos/${fullName}/pulls?state=open&per_page=30&sort=updated&direction=desc`);

  return Promise.all(
    prs.map(async (pr) => {
      let ciStatus = "unknown";
      try {
        const status = await ghFetch(token, `/repos/${fullName}/commits/${pr.head.sha}/status`);
        if (status.state === "success") ciStatus = "success";
        else if (status.state === "failure" || status.state === "error") ciStatus = "failure";
        else if (status.state === "pending") ciStatus = "pending";
      } catch {
        ciStatus = "unknown";
      }

      let reviewDecision = null;
      try {
        const reviews = await ghFetch(token, `/repos/${fullName}/pulls/${pr.number}/reviews`);
        reviewDecision = reviews[reviews.length - 1]?.state ?? null;
      } catch {
        reviewDecision = null;
      }

      return {
        githubPrId: pr.id,
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user?.login ?? "desconocido",
        isDraft: pr.draft,
        reviewDecision,
        ciStatus,
        githubCreatedAt: pr.created_at,
        githubUpdatedAt: pr.updated_at,
        state: "open",
      };
    })
  );
}

export async function fetchIssues(token, fullName) {
  const raw = await ghFetch(token, `/repos/${fullName}/issues?state=open&per_page=50&sort=updated&direction=desc`);
  return raw
    .filter((i) => !i.pull_request)
    .map((issue) => ({
      githubIssueId: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      author: issue.user?.login ?? "desconocido",
      labels: (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
      hasAssignee: Boolean(issue.assignee || issue.assignees?.length),
      milestone: issue.milestone?.title ?? null,
      githubCreatedAt: issue.created_at,
      githubUpdatedAt: issue.updated_at,
      state: "open",
    }));
}

export async function fetchWorkflowRuns(token, fullName) {
  try {
    const data = await ghFetch(token, `/repos/${fullName}/actions/runs?per_page=15`);
    return (data.workflow_runs || []).map((run) => ({
      githubRunId: run.id,
      name: run.name,
      branch: run.head_branch,
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      githubUpdatedAt: run.updated_at,
    }));
  } catch (err) {
    logger.warn("No se pudieron obtener workflow runs (puede no tener Actions habilitado)", {
      repo: fullName,
      error: err.message,
    });
    return [];
  }
}

// Dependabot alerts requieren el scope "security_events" en el token.
// Si no está disponible, se degrada a 0 vulnerabilidades sin romper el flujo.
export async function fetchCriticalVulnerabilities(token, fullName) {
  try {
    const alerts = await ghFetch(token, `/repos/${fullName}/dependabot/alerts?state=open&severity=critical`);
    return Array.isArray(alerts) ? alerts.length : 0;
  } catch (err) {
    logger.debug("Dependabot alerts no disponibles para este repo/token", {
      repo: fullName,
      error: err.message,
    });
    return 0;
  }
}

export async function validateGitHubToken(token) {
  const data = await ghFetch(token, "/user");
  return { login: data.login, id: data.id, avatarUrl: data.avatar_url };
}
