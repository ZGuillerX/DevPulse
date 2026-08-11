import { Router } from "express";
import * as workspaceController from "../controllers/workspace.controller.js";
import { createWorkspaceSchema, inviteMemberSchema, updateRoleSchema } from "../controllers/workspace.schemas.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/", validateBody(createWorkspaceSchema), workspaceController.createWorkspace);
router.get("/", workspaceController.listMyWorkspaces);

router.get("/:workspaceId/members", requireWorkspaceRole("viewer"), workspaceController.listMembers);
router.post(
  "/:workspaceId/members",
  requireWorkspaceRole("admin"),
  validateBody(inviteMemberSchema),
  workspaceController.inviteMember
);
router.patch(
  "/:workspaceId/members/:userId",
  requireWorkspaceRole("admin"),
  validateBody(updateRoleSchema),
  workspaceController.updateMemberRole
);
router.delete("/:workspaceId/members/:userId", requireWorkspaceRole("admin"), workspaceController.removeMember);

export default router;
