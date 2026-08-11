import rateLimit from "express-rate-limit";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Limita peticiones por usuario autenticado (o por IP si no hay usuario aún).
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    logger.warn("Rate limit propio excedido", { key: req.user?.id || req.ip, path: req.path });
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Demasiadas peticiones. Intenta de nuevo en un momento.",
      },
    });
  },
});

// Límite más estricto para endpoints sensibles (login, registro)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit de auth excedido", { ip: req.ip, path: req.path });
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Demasiados intentos. Espera 15 minutos.",
      },
    });
  },
});
