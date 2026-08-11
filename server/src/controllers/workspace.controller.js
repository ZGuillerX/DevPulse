import { AppError } from "../middleware/errorHandler.js";
import * as WorkspaceModel from "../models/workspace.model.js";
import * as UserModel from "../models/user.model.js";
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
    await WorkspaceModel.removeMember({ workspaceId, userId });
    await logAudit({ userId: req.user.id, workspaceId, action: "member.removed", req, metadata: { targetUserId: userId } });
    res.json({ message: "Miembro eliminado." });
  } catch (err) {
    next(err);
  }
}
