import { AppError } from "../middleware/errorHandler.js";
import * as WorkspaceModel from "../models/workspace.model.js";
import * as UserModel from "../models/user.model.js";
import * as AlertService from "../services/alert.service.js";
import { logAudit } from "./auth.controller.js";

export async function createWorkspace(req, res, next) {
  try {
    const { name } = req.body;
    const workspace = await WorkspaceModel.createWorkspace({ name, ownerId: req.user.id });
    await logAudit({ userId: req.user.id, workspaceId: workspace.id, action: "workspace.created", req, metadata: { name } });
    req.log.info("Workspace creado", { workspaceId: workspace.id });
    res.status(201).json({ workspace });
  } catch (err) {
    next(err);
  }
}

export async function listMyWorkspaces(req, res, next) {
  try {
    const workspaces = await WorkspaceModel.listUserWorkspaces(req.user.id);
    res.json({ workspaces });
  } catch (err) {
    next(err);
  }
}

export async function listMembers(req, res, next) {
  try {
    const members = await WorkspaceModel.listMembers(req.params.workspaceId);
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

export async function inviteMember(req, res, next) {
  try {
    const { email, role } = req.body;
    const user = await UserModel.findUserByEmail(email);
    if (!user) throw new AppError("No existe un usuario con ese correo.", 404, "USER_NOT_FOUND");

    await WorkspaceModel.addMember({ workspaceId: req.params.workspaceId, userId: user.id, role });
    await logAudit({
      userId: req.user.id,
      workspaceId: req.params.workspaceId,
      action: "member.invited",
      req,
      metadata: { invitedEmail: email, role },
    });
    req.log.info("Miembro invitado", { workspaceId: req.params.workspaceId, invitedUserId: user.id });
    res.status(201).json({ message: "Miembro agregado." });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const { role } = req.body;
    const { workspaceId, userId } = req.params;

    // Un admin (no owner) podía subirse a sí mismo o a cualquiera a "owner"
    // vía este endpoint, o degradar al owner actual — ambas son escalada de
    // privilegios. Solo un owner puede otorgar o modificar el rol de owner.
    const targetCurrentRole = await WorkspaceModel.getMemberRole(workspaceId, userId);
    const callerIsOwner = req.workspaceRole === "owner";

    if (role === "owner" && !callerIsOwner) {
      throw new AppError("Solo un owner puede otorgar el rol de owner.", 403, "FORBIDDEN");
    }
    if (targetCurrentRole === "owner" && !callerIsOwner) {
      throw new AppError("Solo un owner puede cambiar el rol de otro owner.", 403, "FORBIDDEN");
    }
    if (targetCurrentRole === "owner" && role !== "owner") {
      const ownerCount = await WorkspaceModel.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new AppError(
          "No puedes quitarle el rol de owner al único owner del workspace. Asigna otro owner primero.",
          400,
          "LAST_OWNER"
        );
      }
    }

    await WorkspaceModel.updateMemberRole({ workspaceId, userId, role });
    await logAudit({
      userId: req.user.id,
      workspaceId,
      action: "member.role_changed",
      req,
      metadata: { targetUserId: userId, newRole: role },
    });
    res.json({ message: "Rol actualizado." });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    const { workspaceId, userId } = req.params;

    const targetCurrentRole = await WorkspaceModel.getMemberRole(workspaceId, userId);
    if (targetCurrentRole === "owner") {
      if (req.workspaceRole !== "owner") {
        throw new AppError("Solo un owner puede quitar a otro owner.", 403, "FORBIDDEN");
      }
      const ownerCount = await WorkspaceModel.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new AppError("No puedes quitar al único owner del workspace.", 400, "LAST_OWNER");
      }
    }

    await WorkspaceModel.removeMember({ workspaceId, userId });
    await logAudit({ userId: req.user.id, workspaceId, action: "member.removed", req, metadata: { targetUserId: userId } });
    res.json({ message: "Miembro eliminado." });
  } catch (err) {
    next(err);
  }
}

export async function getAlertSettings(req, res, next) {
  try {
    const settings = await AlertService.getAlertSettings(req.user.id, req.params.workspaceId);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updateAlertSettings(req, res, next) {
  try {
    await AlertService.upsertAlertSettings(req.user.id, req.params.workspaceId, req.body);
    const settings = await AlertService.getAlertSettings(req.user.id, req.params.workspaceId);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}
