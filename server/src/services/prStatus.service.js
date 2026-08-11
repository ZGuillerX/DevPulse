function daysSince(dateIso) {
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24));
}

export function deriveStatus(pr) {
  const daysOpen = daysSince(pr.githubCreatedAt);

  if (pr.ciStatus === "failure") return "checks_failing";
  if (pr.reviewDecision === "CHANGES_REQUESTED") return "changes_requested";
  if (daysOpen >= 7) return "stale";
  return "clean";
}

export function enrichPullRequest(pr) {
  return {
    ...pr,
    daysOpen: daysSince(pr.githubCreatedAt),
    derivedStatus: deriveStatus(pr),
  };
}

export function enrichIssue(issue) {
  return {
    ...issue,
    daysOpen: daysSince(issue.githubCreatedAt),
    isStale: daysSince(issue.githubUpdatedAt) >= 14,
  };
}
