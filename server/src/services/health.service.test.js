import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateHealthScore } from "./health.service.js";

test("repo saludable: CI pasando, sin issues viejos, actividad reciente", () => {
  const result = calculateHealthScore({
    pullRequests: [],
    issues: [],
    workflowRuns: [
      { name: "CI", conclusion: "success", githubUpdatedAt: new Date().toISOString() },
    ],
    pushedAt: new Date().toISOString(),
    criticalVulnerabilities: 0,
  });

  assert.equal(result.status, "healthy");
  assert.ok(result.score >= 80, `esperaba score >= 80, obtuvo ${result.score}`);
});

test("repo crítico: CI roto + vulnerabilidad crítica", () => {
  const result = calculateHealthScore({
    pullRequests: [],
    issues: [],
    workflowRuns: [
      { name: "CI", conclusion: "failure", githubUpdatedAt: new Date().toISOString() },
    ],
    pushedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    criticalVulnerabilities: 1,
  });

  assert.equal(result.status, "critical");
  assert.ok(
    result.breakdown.some((b) => b.factor === "Workflow fallido"),
    "debe incluir el factor de workflow fallido en el breakdown"
  );
  assert.ok(
    result.breakdown.some((b) => b.factor === "Vulnerabilidad crítica"),
    "debe incluir el factor de vulnerabilidad crítica"
  );
});

test("PRs sin revisión durante 3+ días penalizan el score", () => {
  const oldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const result = calculateHealthScore({
    pullRequests: [
      { githubCreatedAt: oldDate, githubUpdatedAt: oldDate, reviewDecision: null },
    ],
    issues: [],
    workflowRuns: [],
    pushedAt: null,
    criticalVulnerabilities: 0,
  });

  assert.ok(
    result.breakdown.some((b) => b.factor === "PRs sin revisión"),
    "debe detectar el PR sin revisión"
  );
});

test("el score nunca baja de 0 ni sube de 100", () => {
  const manyFailures = Array.from({ length: 10 }, (_, i) => ({
    name: `workflow-${i}`,
    conclusion: "failure",
    githubUpdatedAt: new Date().toISOString(),
  }));

  const result = calculateHealthScore({
    pullRequests: [],
    issues: [],
    workflowRuns: manyFailures,
    pushedAt: null,
    criticalVulnerabilities: 5,
  });

  assert.ok(result.score >= 0 && result.score <= 100);
});
