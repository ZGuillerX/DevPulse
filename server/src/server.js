import "dotenv/config";
import { createApp } from "./app.js";
import { config, validateConfig } from "./config/env.js";
import { verifyDbConnection } from "./config/db.js";
import { startPeriodicSync } from "./jobs/periodicSync.job.js";
import { logger } from "./utils/logger.js";

async function main() {
  validateConfig();

  const dbOk = await verifyDbConnection();
  if (!dbOk) {
    logger.warn("Base de datos no disponible; el servidor continuará en modo desarrollo con advertencia. Revisa DB_HOST/DB_USER/DB_PASSWORD cuando quieras habilitar consultas reales.");
  }

  const app = createApp();

  app.listen(config.port, () => {
    logger.info("DevPulse server iniciado", { port: config.port, env: config.env });
  });

  if (config.env !== "test" && dbOk) {
    startPeriodicSync();
  }
}

main().catch((err) => {
  logger.error("Fallo fatal al iniciar el servidor", { error: err.message, stack: err.stack });
  process.exit(1);
});
