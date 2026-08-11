import { logger } from "../utils/logger.js";

const REQUIRED_VARS = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET"];

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    logger.error("Falta variable de entorno requerida", { variable: name });
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),

  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "devpulse",
    port: Number(process.env.DB_PORT || 3306),
  },

  jwt: {
    secret: process.env.JWT_SECRET || "change-this-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    // Debes configurar esto en tu GitHub OAuth App con la URL pública real
    callbackUrl: process.env.GITHUB_CALLBACK_URL || "http://localhost:4000/api/auth/github/callback",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
  },

  ai: {
    groqApiKey: process.env.GROQ_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
  },

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  rateLimit: {
    windowMs: 60 * 1000, // 1 minuto
    max: Number(process.env.RATE_LIMIT_PER_MINUTE || 100),
  },

  cache: {
    ttlSeconds: Number(process.env.CACHE_TTL_SECONDS || 120),
  },
};

export function validateConfig() {
  if (config.env === "production") {
    for (const key of REQUIRED_VARS) {
      requireEnv(key);
    }
    if (config.jwt.secret === "change-this-in-production") {
      logger.error("JWT_SECRET no configurado de forma segura para producción");
      throw new Error("JWT_SECRET must be set in production");
    }
  }
  logger.info("Configuración validada", { env: config.env });
}
