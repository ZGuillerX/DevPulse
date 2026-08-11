import { Router } from "express";
import { handleGitHubWebhook } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/github", handleGitHubWebhook);

export default router;
