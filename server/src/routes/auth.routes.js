import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { registerSchema, loginSchema } from "../controllers/auth.schemas.js";
import { validateBody } from "../middleware/validate.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", authRateLimiter, validateBody(registerSchema), authController.register);
router.post("/login", authRateLimiter, validateBody(loginSchema), authController.login);

router.get("/github", authController.githubOAuthRedirect);
router.get("/github/callback", authController.githubOAuthCallback);

router.get("/me", requireAuth, authController.me);

export default router;
