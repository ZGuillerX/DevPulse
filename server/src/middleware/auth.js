import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { AppError } from "./errorHandler.js";
import { query } from "../config/db.js";

// Verifica el JWT y adjunta el usuario autenticado a req.user
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("Token de autenticación faltante.", 401, "UNAUTHORIZED");
    }

    const token = header.slice("Bearer ".length);
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      throw new AppError("Token inválido o expirado.", 401, "INVALID_TOKEN");
    }

    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}

// RBAC: exige que el usuario tenga uno de los roles permitidos en el workspace
// indicado por req.params.workspaceId. Debe usarse DESPUÉS de requireAuth.
const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function requireWorkspaceRole(minRole) {
  return async function (req, res, next) {
    try {
      const workspaceId = req.params.workspaceId || req.body.workspaceId;
      if (!workspaceId) {
        throw new AppError("workspaceId requerido.", 400, "MISSING_WORKSPACE");
      }

      const rows = await query(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
        [workspaceId, req.user.id]
      );

      if (rows.length === 0) {
        throw new AppError("No perteneces a este workspace.", 403, "FORBIDDEN");
      }

      const userRole = rows[0].role;
      if (ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
        throw new AppError(
          `Esta acción requiere rol '${minRole}' o superior.`,
          403,
          "INSUFFICIENT_ROLE"
        );
      }

      req.workspaceRole = userRole;
      next();
    } catch (err) {
      next(err);
    }
  };
}
