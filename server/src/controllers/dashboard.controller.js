import * as RepoModel from "../models/repository.model.js";
import * as UserModel from "../models/user.model.js";
import { query } from "../config/db.js";
import { buildPriorityList } from "../services/priority.service.js";
import { generateDailyBrief } from "../services/ai.service.js";
import { cacheWrap } from "../services/cache.service.js";
import { config } from "../config/env.js";

export async function getDashboard(req, res, next) {
  try {
    const { workspaceId } = req.params;

    const cacheKey = `dashboard:${workspaceId}`;
    const data = await cacheWrap(cacheKey, 60, () => buildDashboardData(workspaceId));

    const user = await UserModel.findUserById(req.user.id);
    const brief = await generateDailyBrief({
      userName: user?.name,
      priorityItems: data.priorityItems,
      healthScores: data.healthScores,
      provider: req.query.aiProvider || "groq",
      apiKey: req.headers["x-ai-key"] || "",
    });

    res.json({ ...data, brief });
  } catch (err) {
    next(err);
  }
}

async function buildDashboardData(workspaceId) {
  const { items: repos } = await RepoModel.listRepositories(workspaceId, { page: 1, limit: 100 });

  const pullRequests = [];
  const issues = [];
  const healthScores = [];

  for (const repo of repos) {
    const prs = await query(
      "SELECT * FROM pull_requests WHERE repository_id = ? AND state = 'open'",
      [repo.id]
    );
    const repoIssues = await query("SELECT * FROM issues WHERE repository_id = ? AND state = 'open'", [repo.id]);

    pullRequests.push(
      ...prs.map((pr) => ({
        id: pr.id,
        repoFullName: repo.full_name,
        title: pr.title,
        url: pr.url,
        derivedStatus: pr.derived_status,
        daysOpen: Math.floor((Date.now() - new Date(pr.github_created_at).getTime()) / 86400000),
      }))
    );

    issues.push(
      ...repoIssues.map((i) => ({
        id: i.id,
        repoFullName: repo.full_name,
        title: i.title,
        url: i.url,
        hasAssignee: Boolean(i.has_assignee),
        isStale: Math.floor((Date.now() - new Date(i.github_updated_at).getTime()) / 86400000) >= 14,
        daysOpen: Math.floor((Date.now() - new Date(i.github_created_at).getTime()) / 86400000),
      }))
    );

    if (repo.latest_health_score !== null) {
      healthScores.push({ repoFullName: repo.full_name, score: repo.latest_health_score, status: healthStatus(repo.latest_health_score) });
    }
  }

  const priorityItems = buildPriorityList({ pullRequests, issues, criticalVulnerabilities: [] });

  return {
    repos,
    healthScores,
    priorityItems,
    summary: {
      totalRepos: repos.length,
      openPRs: pullRequests.length,
      openIssues: issues.length,
      failingCI: pullRequests.filter((p) => p.derivedStatus === "checks_failing").length,
      avgHealth: healthScores.length
        ? Math.round(healthScores.reduce((a, h) => a + h.score, 0) / healthScores.length)
        : null,
    },
  };
}

function healthStatus(score) {
  if (score >= 80) return "healthy";
  if (score >= 60) return "warning";
  return "critical";
}
