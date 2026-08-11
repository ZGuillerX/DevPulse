export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Middleware final: cualquier error lanzado (o pasado con next(err)) cae aquí.
// Nunca expone stack traces ni detalles internos al cliente en producción.
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";

  const log = req.log || console;
  log.error("Error no controlado", {
    error: err.message,
    code,
    statusCode,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 ? "Ocurrió un error interno." : err.message,
      requestId: req.requestId,
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Ruta no encontrada: ${req.method} ${req.path}`,
      requestId: req.requestId,
    },
  });
}
