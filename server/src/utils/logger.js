const LEVELS = { ERROR: "ERROR", WARN: "WARN", INFO: "INFO", DEBUG: "DEBUG" };

const isProd = process.env.NODE_ENV === "production";

function timestamp() {
  return new Date().toISOString();
}

function format(level, message, meta = {}) {
  const base = { level, message, timestamp: timestamp(), ...meta };

  if (isProd) {
    // En producción: JSON estructurado, fácil de parsear por herramientas de logs
    return JSON.stringify(base);
  }

  // En desarrollo: legible en consola
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${base.timestamp}] ${level.padEnd(5)} ${message}${metaStr}`;
}

function log(level, message, meta) {
  const line = format(level, message, meta);
  if (level === LEVELS.ERROR) console.error(line);
  else if (level === LEVELS.WARN) console.warn(line);
  else console.log(line);
}

export const logger = {
  error: (message, meta) => log(LEVELS.ERROR, message, meta),
  warn: (message, meta) => log(LEVELS.WARN, message, meta),
  info: (message, meta) => log(LEVELS.INFO, message, meta),
  debug: (message, meta) => {
    if (process.env.LOG_LEVEL === "debug") log(LEVELS.DEBUG, message, meta);
  },
  // Logger con contexto fijo (ej. requestId) para seguir un flujo completo
  child: (context) => ({
    error: (message, meta) => log(LEVELS.ERROR, message, { ...context, ...meta }),
    warn: (message, meta) => log(LEVELS.WARN, message, { ...context, ...meta }),
    info: (message, meta) => log(LEVELS.INFO, message, { ...context, ...meta }),
    debug: (message, meta) => {
      if (process.env.LOG_LEVEL === "debug") log(LEVELS.DEBUG, message, { ...context, ...meta });
    },
  }),
};
