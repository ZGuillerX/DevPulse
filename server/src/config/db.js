import mysql from "mysql2/promise";
import { config } from "./env.js";
import { logger } from "../utils/logger.js";

export const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

export async function verifyDbConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info("Conexión a MySQL establecida", { database: config.db.database });
    return true;
  } catch (err) {
    logger.error("No se pudo conectar a MySQL", { error: err.message, code: err.code });
    return false;
  }
}

// Helper para queries con logging de duración — útil para detectar queries lentas
export async function query(sql, params = []) {
  const start = Date.now();
  try {
    const [rows] = await pool.query(sql, params);
    const durationMs = Date.now() - start;
    if (durationMs > 200) {
      logger.warn("Query lenta detectada", { sql: sql.slice(0, 100), durationMs });
    }
    return rows;
  } catch (err) {
    logger.error("Error ejecutando query", { sql: sql.slice(0, 100), error: err.message });
    throw err;
  }
}
