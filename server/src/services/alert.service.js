import { randomUUID } from "crypto";
import { query } from "../config/db.js";
import { sendAlertEmail } from "./email.service.js";
import { logger } from "../utils/logger.js";

export async function getAlertSettings(userId, workspaceId) {
  const rows = await query("SELECT * FROM alert_settings WHERE user_id = ? AND workspace_id = ?", [userId, workspaceId]);
  if (rows.length > 0) return rows[0];

  // Defaults si el usuario no ha configurado nada aún
  return {
    ci_failure: true,
    pr_waiting_days: 3,
    issue_inactive_days: 14,
    health_score_threshold: 60,
    email_enabled: false,
  };
}

export async function upsertAlertSettings(userId, workspaceId, settings) {
  await query(
    `INSERT INTO alert_settings (id, user_id, workspace_id, ci_failure, pr_waiting_days, issue_inactive_days, health_score_threshold, email_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ci_failure = VALUES(ci_failure), pr_waiting_days = VALUES(pr_waiting_days),
       issue_inactive_days = VALUES(issue_inactive_days), health_score_threshold = VALUES(health_score_threshold),
       email_enabled = VALUES(email_enabled)`,
    [
      randomUUID(),
      userId,
      workspaceId,
      settings.ciFailure,
      settings.prWaitingDays,
      settings.issueInactiveDays,
      settings.healthScoreThreshold,
      settings.emailEnabled,
    ]
  );
}

async function createNotification({ userId, workspaceId, type, title, body, url, email, emailEnabled }) {
  await query(
    "INSERT INTO notifications (id, user_id, workspace_id, type, title, body, url) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), userId, workspaceId, type, title, body, url]
  );
  logger.info("Notificación creada", { userId, type, title });

  if (emailEnabled && email) {
    await sendAlertEmail({
      to: email,
      subject: `DevPulse — ${title}`,
      html: `<p>${body}</p>`,
    });
  }
}

// Se llama después de cada sincronización para evaluar si hay que alertar
export async function evaluateAlerts({ workspaceId, repoFullName, healthResult, failingWorkflows = [] }) {
  const members = await query(
    `SELECT wm.user_id, u.email FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?`,
    [workspaceId]
  );

  for (const { user_id: userId, email } of members) {
    const settings = await getAlertSettings(userId, workspaceId);
    const emailEnabled = Boolean(settings.email_enabled);

    if (settings.ci_failure && failingWorkflows.length > 0) {
      await createNotification({
        userId,
        workspaceId,
        type: "ci_failure",
        title: `CI fallando en ${repoFullName}`,
        body: `${failingWorkflows.length} workflow(s) fallando.`,
        url: null,
        email,
        emailEnabled,
      });
    }

    if (healthResult.score < settings.health_score_threshold) {
      await createNotification({
        userId,
        workspaceId,
        type: "health_drop",
        title: `Salud baja en ${repoFullName}`,
        body: `Health score: ${healthResult.score}/100 (umbral: ${settings.health_score_threshold}).`,
        url: null,
        email,
        emailEnabled,
      });
    }
  }
}

export async function listNotifications(userId, { unreadOnly = false } = {}) {
  const where = unreadOnly ? "user_id = ? AND read_at IS NULL" : "user_id = ?";
  return query(`SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT 50`, [userId]);
}

export async function markNotificationRead(notificationId, userId) {
  await query("UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?", [notificationId, userId]);
}
