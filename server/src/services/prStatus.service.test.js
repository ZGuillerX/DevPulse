import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveStatus } from "./prStatus.service.js";

test("CI fallando tiene prioridad sobre cualquier otro estado", () => {
  const status = deriveStatus({
    ciStatus: "failure",
    reviewDecision: "CHANGES_REQUESTED",
    githubCreatedAt: new Date().toISOString(),
  });
  assert.equal(status, "checks_failing");
});

test("cambios solicitados sin CI roto", () => {
  const status = deriveStatus({
    ciStatus: "success",
    reviewDecision: "CHANGES_REQUESTED",
    githubCreatedAt: new Date().toISOString(),
  });
  assert.equal(status, "changes_requested");
});

test("PR abierto hace 7+ días sin problemas se marca como stale", () => {
  const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const status = deriveStatus({ ciStatus: "success", reviewDecision: null, githubCreatedAt: oldDate });
  assert.equal(status, "stale");
});

test("PR reciente, CI ok, sin cambios solicitados -> clean", () => {
  const status = deriveStatus({
    ciStatus: "success",
    reviewDecision: "APPROVED",
    githubCreatedAt: new Date().toISOString(),
  });
  assert.equal(status, "clean");
});
