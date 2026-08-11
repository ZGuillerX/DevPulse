const URGENCY_RANK = { alta: 0, media: 1, baja: 2 };

export function buildPriorityList({ pullRequests = [], issues = [], criticalVulnerabilities = [] }) {
  const items = [];

  for (const pr of pullRequests) {
    if (pr.derivedStatus === "checks_failing") {
      items.push({
        type: "ci",
        repo: pr.repoFullName,
        refId: pr.id,
        title: pr.title,
        url: pr.url,
        reason: "El CI está fallando en este PR.",
        urgency: "alta",
      });
    } else if (pr.derivedStatus === "changes_requested") {
      items.push({
        type: "pr",
        repo: pr.repoFullName,
        refId: pr.id,
        title: pr.title,
        url: pr.url,
        reason: "Tiene cambios solicitados sin resolver.",
        urgency: "media",
      });
    } else if (pr.derivedStatus === "stale") {
      items.push({
        type: "pr",
        repo: pr.repoFullName,
        refId: pr.id,
        title: pr.title,
        url: pr.url,
        reason: `Lleva ${pr.daysOpen} días abierto sin resolución.`,
        urgency: pr.daysOpen >= 14 ? "alta" : "media",
      });
    }
  }

  for (const issue of issues) {
    if (!issue.hasAssignee && issue.daysOpen >= 3) {
      items.push({
        type: "issue",
        repo: issue.repoFullName,
        refId: issue.id,
        title: issue.title,
        url: issue.url,
        reason: `Sin asignar hace ${issue.daysOpen} días.`,
        urgency: issue.daysOpen >= 14 ? "media" : "baja",
      });
    } else if (issue.isStale) {
      items.push({
        type: "issue",
        repo: issue.repoFullName,
        refId: issue.id,
        title: issue.title,
        url: issue.url,
        reason: "Sin actividad hace más de 14 días.",
        urgency: "baja",
      });
    }
  }

  for (const vuln of criticalVulnerabilities) {
    items.push({
      type: "security",
      repo: vuln.repoFullName,
      refId: vuln.id ?? vuln.package,
      title: `Vulnerabilidad crítica: ${vuln.package}`,
      url: vuln.url ?? "",
      reason: "Vulnerabilidad de severidad crítica detectada por Dependabot.",
      urgency: "alta",
    });
  }

  return items.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
}
