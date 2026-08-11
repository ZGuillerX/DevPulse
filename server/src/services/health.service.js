import { logger } from "../utils/logger.js";

// Cada factor suma o resta puntos, y queda registrado en el breakdown para
// que el score sea EXPLICABLE, no una caja negra. Los pesos son ajustables.
const WEIGHTS = {
  CI_PASSING: 20,
  RECENT_PR_ACTIVITY: 15,
  STALE_ISSUES: -10,
  UNREVIEWED_PRS: -15,
  FAILED_WORKFLOW: -20,
  CRITICAL_VULNERABILITY: -30,
  RECENT_ACTIVITY: 10,
};

const BASE_SCORE = 60;

/**
 * @param {object} input
 * @param {Array} input.pullRequests - PRs abiertos del repo (con derived_status, ci_status)
 * @param {Array} input.issues - issues abiertos del repo (con daysOpen, isStale)
 * @param {Array} input.workflowRuns - últimas ejecuciones de CI
 * @param {string} input.pushedAt - último push al repo
 * @param {number} input.criticalVulnerabilities - conteo de alertas críticas (Dependabot)
 */
export function calculateHealthScore(input) {
  const { pullRequests = [], issues = [], workflowRuns = [], pushedAt, criticalVulnerabilities = 0 } = input;

  const breakdown = [];
  let score = BASE_SCORE;

  function apply(factor, points, reason) {
    score += points;
    breakdown.push({ factor, points, reason });
  }

  // CI funcionando: si el run más reciente de cada workflow fue exitoso
  const latestRuns = latestRunPerWorkflow(workflowRuns);
  const failingRuns = latestRuns.filter((r) => r.conclusion === "failure");
  if (latestRuns.length > 0 && failingRuns.length === 0) {
    apply("CI funcionando", WEIGHTS.CI_PASSING, "Todos los workflows recientes pasaron.");
  }
  if (failingRuns.length > 0) {
    apply(
      "Workflow fallido",
      WEIGHTS.FAILED_WORKFLOW,
      `${failingRuns.length} workflow(s) fallando: ${failingRuns.map((r) => r.name).join(", ")}.`
    );
  }

  // Actividad reciente de PRs (creados o actualizados en los últimos 7 días)
  const recentPRs = pullRequests.filter((pr) => daysSince(pr.githubUpdatedAt ?? pr.updatedAt) <= 7);
  if (recentPRs.length > 0) {
    apply("PRs recientes", WEIGHTS.RECENT_PR_ACTIVITY, `${recentPRs.length} PR(s) con actividad esta semana.`);
  }

  // PRs sin revisión (más de 3 días abiertos sin review)
  const unreviewed = pullRequests.filter(
    (pr) => !pr.reviewDecision && daysSince(pr.githubCreatedAt ?? pr.createdAt) >= 3
  );
  if (unreviewed.length > 0) {
    apply(
      "PRs sin revisión",
      WEIGHTS.UNREVIEWED_PRS,
      `${unreviewed.length} PR(s) llevan 3+ días esperando revisión.`
    );
  }

  // Issues antiguos sin actividad (14+ días)
  const staleIssues = issues.filter((i) => daysSince(i.githubUpdatedAt ?? i.updatedAt) >= 14);
  if (staleIssues.length > 0) {
    apply("Issues antiguos", WEIGHTS.STALE_ISSUES, `${staleIssues.length} issue(s) sin actividad hace 14+ días.`);
  }

  // Vulnerabilidades críticas
  if (criticalVulnerabilities > 0) {
    apply(
      "Vulnerabilidad crítica",
      WEIGHTS.CRITICAL_VULNERABILITY,
      `${criticalVulnerabilities} vulnerabilidad(es) crítica(s) sin resolver.`
    );
  }

  // Actividad reciente general del repo
  if (pushedAt && daysSince(pushedAt) <= 3) {
    apply("Actividad reciente", WEIGHTS.RECENT_ACTIVITY, "Hubo commits en los últimos 3 días.");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  logger.debug("Health score calculado", { finalScore, factorCount: breakdown.length });

  return {
    score: finalScore,
    status: statusFromScore(finalScore),
    breakdown,
  };
}

function latestRunPerWorkflow(runs) {
  const byName = new Map();
  for (const run of runs) {
    const existing = byName.get(run.name);
    if (!existing || new Date(run.githubUpdatedAt ?? run.updatedAt) > new Date(existing.githubUpdatedAt ?? existing.updatedAt)) {
      byName.set(run.name, run);
    }
  }
  return [...byName.values()];
}

function daysSince(dateIso) {
  if (!dateIso) return Infinity;
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24));
}

function statusFromScore(score) {
  if (score >= 80) return "healthy";
  if (score >= 60) return "warning";
  return "critical";
}
