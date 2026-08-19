import crypto from "crypto";
import { config } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { query } from "../config/db.js";
import { syncRepository } from "../services/sync.service.js";
import { decrypt } from "../utils/crypto.js";
import { invalidateWorkspaceCaches } from "../services/cache.service.js";

// Verifica que el payload realmente venga de GitHub, no de un tercero
// suplantando el endpoint. GitHub firma cada payload con HMAC-SHA256
// usando el secret configurado en la webhook de tu repo.
function verifySignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !config.github.webhookSecret) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", config.github.webhookSecret).update(req.rawBody || "").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function findRepositoryByFullName(fullName) {
  const rows = await query("SELECT * FROM repositories WHERE full_name = ?", [fullName]);
  return rows[0] || null;
}

async function getTokenForWorkspace(workspaceId) {
  const rows = await query(
    `SELECT u.github_access_token_encrypted FROM users u
     JOIN workspace_members wm ON wm.user_id = u.id
     WHERE wm.workspace_id = ? AND wm.role = 'owner' LIMIT 1`,
    [workspaceId]
  );
  const encrypted = rows[0]?.github_access_token_encrypted;
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    // Token no desencriptable (p. ej. ENCRYPTION_KEY cambió) — se trata igual
    // que "sin token" para no tumbar el webhook con un 500.
    return null;
  }
}

// Eventos que nos interesan: push, pull_request, issues, workflow_run, release
export async function handleGitHubWebhook(req, res, next) {
  try {
    if (!verifySignature(req)) {
      req.log.warn("Webhook con firma inválida rechazado");
      throw new AppError("Firma de webhook inválida.", 401, "INVALID_SIGNATURE");
    }

    const event = req.headers["x-github-event"];
    const payload = req.body;
    const fullName = payload.repository?.full_name;

    req.log.info("Webhook de GitHub recibido", { event, repo: fullName });

    if (!fullName) {
      return res.status(200).json({ message: "Evento ignorado (sin repositorio asociado)." });
    }

    const repo = await findRepositoryByFullName(fullName);
    if (!repo) {
      // Repo no rastreado por ningún workspace — ignoramos sin error
      return res.status(200).json({ message: "Repositorio no rastreado." });
    }

    const relevantEvents = ["push", "pull_request", "issues", "workflow_run", "release"];
    if (!relevantEvents.includes(event)) {
      return res.status(200).json({ message: "Evento no relevante, ignorado." });
    }

    const token = await getTokenForWorkspace(repo.workspace_id);
    if (!token) {
      req.log.warn("No hay token disponible para re-sincronizar tras webhook", { repositoryId: repo.id });
      return res.status(200).json({ message: "Sin token disponible, sincronización omitida." });
    }

    // Re-sincroniza el repo afectado: esto recalcula health score y prioridades
    await syncRepository(repo.id, token, repo.full_name);
    await invalidateWorkspaceCaches(repo.workspace_id);

    req.log.info("Repositorio re-sincronizado por webhook", { repositoryId: repo.id, event });
    res.status(200).json({ message: "Sincronizado correctamente." });
  } catch (err) {
    next(err);
  }
}
