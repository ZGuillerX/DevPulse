import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get("/", requireWorkspaceRole("viewer"), dashboardController.getDashboard);

export default router;
