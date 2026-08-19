import { query } from "../config/db.js";
import { decrypt } from "../utils/crypto.js";
import { syncRepository } from "../services/sync.service.js";
import { logger } from "../utils/logger.js";

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MINUTES || 15) * 60 * 1000;

async function syncAllRepositories() {
  const log = logger.child({ job: "periodic-sync" });
  log.info("Iniciando ciclo de sincronización periódica");

  const repos = await query(
    `SELECT r.id, r.full_name, r.workspace_id, u.github_access_token_encrypted
     FROM repositories r
     JOIN workspace_members wm ON wm.workspace_id = r.workspace_id AND wm.role = 'owner'
     JOIN users u ON u.id = wm.user_id
     WHERE u.github_access_token_encrypted IS NOT NULL`
  );

  let succeeded = 0;
  let failed = 0;

  for (const repo of repos) {
    try {
      const token = decrypt(repo.github_access_token_encrypted);
      await syncRepository(repo.id, token, repo.full_name, repo.workspace_id);
      succeeded++;
    } catch (err) {
      failed++;
      log.error("Falló sincronización periódica de un repo", { repositoryId: repo.id, error: err.message });
    }
  }

  log.info("Ciclo de sincronización periódica terminado", { total: repos.length, succeeded, failed });
}

export function startPeriodicSync() {
  logger.info("Job de sincronización periódica programado", { intervalMinutes: SYNC_INTERVAL_MS / 60000 });
  // Corre una vez al iniciar, luego en el intervalo configurado
  syncAllRepositories().catch((err) => logger.error("Error en sync inicial", { error: err.message }));
  setInterval(() => {
    syncAllRepositories().catch((err) => logger.error("Error en sync periódico", { error: err.message }));
  }, SYNC_INTERVAL_MS);
}
