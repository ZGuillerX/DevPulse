import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";

// Asigna un requestId único a cada petición y loguea entrada/salida.
// Esto es lo que te permite seguir un flujo completo en los logs (punto 19).
export function requestLogger(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  req.log = logger.child({ requestId });

  const start = Date.now();
  req.log.info("Petición recibida", { method: req.method, path: req.path });

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    req.log[level]("Petición completada", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  res.setHeader("X-Request-Id", requestId);
  next();
}
