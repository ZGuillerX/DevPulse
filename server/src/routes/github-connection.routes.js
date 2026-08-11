import { Router } from "express";
import * as githubConnectionController from "../controllers/github-connection.controller.js";
import { connectGithubSchema } from "../controllers/github-connection.schemas.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/status", githubConnectionController.getGithubStatus);
router.post("/connect", validateBody(connectGithubSchema), githubConnectionController.connectGithub);
router.post("/disconnect", githubConnectionController.disconnectGithub);

export default router;
