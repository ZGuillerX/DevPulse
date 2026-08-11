import { randomUUID } from "crypto";
import { query, pool } from "../config/db.js";
import * as github from "./github.service.js";
import { enrichPullRequest, enrichIssue } from "./prStatus.service.js";
import { calculateHealthScore } from "./health.service.js";
import { logger } from "../utils/logger.js";

async function upsertSyncStatus(repositoryId, status, errorMessage = null) {
  const rows = await query("SELECT id, retry_count FROM sync_status WHERE repository_id = ?", [repositoryId]);

  if (rows.length === 0) {
    await query(
      `INSERT INTO sync_status (id, repository_id, status, started_at, finished_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        repositoryId,
        status,
        status === "in_progress" ? new Date() : null,
        status !== "in_progress" ? new Date() : null,
        errorMessage,
      ]
    );
    return;
  }

  const retryCount = status === "failed" ? rows[0].retry_count + 1 : rows[0].retry_count;
  await query(
    `UPDATE sync_status SET status = ?, finished_at = ?, error_message = ?, retry_count = ?
     ${status === "in_progress" ? ", started_at = NOW()" : ""}
     WHERE repository_id = ?`,
    [status, status !== "in_progress" ? new Date() : null, errorMessage, retryCount, repositoryId]
  );
}

async function upsertPullRequests(repositoryId, repoFullName, prs) {
  for (const pr of prs) {
    const enriched = enrichPullRequest(pr);
    await query(
      `INSERT INTO pull_requests
        (id, repository_id, github_pr_id, number, title, url, author, is_draft,
         review_decision, ci_status, derived_status, github_created_at, github_updated_at, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
       ON DUPLICATE KEY UPDATE
         title = VALUES(title), review_decision = VALUES(review_decision),
         ci_status = VALUES(ci_status), derived_status = VALUES(derived_status),
         github_updated_at = VALUES(github_updated_at), synced_at = NOW()`,
      [
        randomUUID(),
        repositoryId,
        enriched.githubPrId,
        enriched.number,
        enriched.title,
        enriched.url,
        enriched.author,
        enriched.isDraft,
        enriched.reviewDecision,
        enriched.ciStatus,
        enriched.derivedStatus,
        new Date(enriched.githubCreatedAt),
        new Date(enriched.githubUpdatedAt),
      ]
    );
  }
}

async function upsertIssues(repositoryId, issues) {
  for (const issue of issues) {
    const enriched = enrichIssue(issue);
    await query(
      `INSERT INTO issues
        (id, repository_id, github_issue_id, number, title, url, author, labels,
         has_assignee, milestone, github_created_at, github_updated_at, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
       ON DUPLICATE KEY UPDATE
         title = VALUES(title), labels = VALUES(labels), has_assignee = VALUES(has_assignee),
         github_updated_at = VALUES(github_updated_at), synced_at = NOW()`,
      [
        randomUUID(),
        repositoryId,
        enriched.githubIssueId,
        enriched.number,
        enriched.title,
        enriched.url,
        enriched.author,
        JSON.stringify(enriched.labels),
        enriched.hasAssignee,
        enriched.milestone,
        new Date(enriched.githubCreatedAt),
        new Date(enriched.githubUpdatedAt),
      ]
    );
  }
}

async function upsertWorkflowRuns(repositoryId, runs) {
  for (const run of runs) {
    await query(
      `INSERT INTO workflow_runs (id, repository_id, github_run_id, name, branch, status, conclusion, url, github_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status), conclusion = VALUES(conclusion), github_updated_at = VALUES(github_updated_at), synced_at = NOW()`,
      [
        randomUUID(),
        repositoryId,
        run.githubRunId,
        run.name,
        run.branch,
        run.status,
        run.conclusion,
        run.url,
        new Date(run.githubUpdatedAt),
      ]
    );
  }
}

async function saveHealthSnapshot(repositoryId, healthResult) {
  await query(
    `INSERT INTO health_snapshots (id, repository_id, score, breakdown) VALUES (?, ?, ?, ?)`,
    [randomUUID(), repositoryId, healthResult.score, JSON.stringify(healthResult.breakdown)]
  );
}

/**
 * Sincroniza un repositorio: trae datos frescos de GitHub, los persiste,
 * calcula el health score, y guarda un snapshot histórico.
 * Idempotente: se puede llamar tantas veces como se quiera ("Sync now").
 */
export async function syncRepository(repositoryId, token, repoFullName) {
  const log = logger.child({ repositoryId, repo: repoFullName });
  log.info("Iniciando sincronización");
  await upsertSyncStatus(repositoryId, "in_progress");

  try {
    const [repoData, pullRequests, issues, workflowRuns, criticalVulns] = await Promise.all([
      github.fetchRepo(token, repoFullName),
      github.fetchPullRequests(token, repoFullName),
      github.fetchIssues(token, repoFullName),
      github.fetchWorkflowRuns(token, repoFullName),
      github.fetchCriticalVulnerabilities(token, repoFullName),
    ]);

    await query(
      `UPDATE repositories SET stars = ?, open_issues_count = ?, pushed_at = ?, description = ? WHERE id = ?`,
      [repoData.stars, repoData.openIssuesCount, new Date(repoData.pushedAt), repoData.description, repositoryId]
    );

    await upsertPullRequests(repositoryId, repoFullName, pullRequests);
    await upsertIssues(repositoryId, issues);
    await upsertWorkflowRuns(repositoryId, workflowRuns);

    const healthResult = calculateHealthScore({
      pullRequests: pullRequests.map(enrichPullRequest),
      issues: issues.map(enrichIssue),
      workflowRuns,
      pushedAt: repoData.pushedAt,
      criticalVulnerabilities: criticalVulns,
    });
    await saveHealthSnapshot(repositoryId, healthResult);

    await upsertSyncStatus(repositoryId, "success");
    log.info("Sincronización completada", { healthScore: healthResult.score, prs: pullRequests.length, issues: issues.length });

    return { healthResult, prs: pullRequests.length, issues: issues.length };
  } catch (err) {
    log.error("Sincronización falló", { error: err.message });
    await upsertSyncStatus(repositoryId, "failed", err.message);
    throw err;
  }
}
