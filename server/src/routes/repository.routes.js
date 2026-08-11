import { Router } from "express";
import * as repoController from "../controllers/repository.controller.js";
import {
  addRepositorySchema,
  listRepositoriesQuerySchema,
  paginationQuerySchema,
} from "../controllers/repository.schemas.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post("/", requireWorkspaceRole("member"), validateBody(addRepositorySchema), repoController.addRepository);
router.get("/", requireWorkspaceRole("viewer"), validateQuery(listRepositoriesQuerySchema), repoController.listRepositories);

router.get("/:repositoryId", requireWorkspaceRole("viewer"), repoController.getRepository);
router.get("/:repositoryId/pull-requests", requireWorkspaceRole("viewer"), validateQuery(paginationQuerySchema), repoController.listPullRequests);
router.get("/:repositoryId/issues", requireWorkspaceRole("viewer"), validateQuery(paginationQuerySchema), repoController.listIssues);
router.get("/:repositoryId/health-history", requireWorkspaceRole("viewer"), repoController.getHealthHistory);
router.post("/:repositoryId/sync", requireWorkspaceRole("member"), repoController.triggerSync);
router.delete("/:repositoryId", requireWorkspaceRole("admin"), repoController.removeRepository);

export default router;
