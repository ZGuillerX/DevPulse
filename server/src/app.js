import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";

import authRoutes from "./routes/auth.routes.js";
import workspaceRoutes from "./routes/workspace.routes.js";
import repositoryRoutes from "./routes/repository.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import healthRoutes from "./routes/health.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import githubConnectionRoutes from "./routes/github-connection.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    })
  );
  app.use(requestLogger);

  // El endpoint de webhooks necesita el body CRUDO (sin parsear) para poder
  // verificar la firma HMAC de GitHub byte a byte. Por eso se monta ANTES
  // del express.json() global, con su propio parser que guarda el raw body.
  app.use(
    "/api/webhooks",
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    }),
    webhookRoutes
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(apiRateLimiter);

  app.use("/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/workspaces", workspaceRoutes);
  app.use("/api/workspaces/:workspaceId/repositories", repositoryRoutes);
  app.use("/api/workspaces/:workspaceId/dashboard", dashboardRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/users/github", githubConnectionRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
