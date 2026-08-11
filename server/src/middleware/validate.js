import { AppError } from "./errorHandler.js";

// Middleware factory: valida req.body contra un schema de Zod.
// Uso: router.post("/x", validateBody(schema), controller)
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return next(new AppError(`Datos inválidos: ${message}`, 400, "VALIDATION_ERROR"));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return next(new AppError(`Parámetros inválidos: ${message}`, 400, "VALIDATION_ERROR"));
    }
    req.query = result.data;
    next();
  };
}
