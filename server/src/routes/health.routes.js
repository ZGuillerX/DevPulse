import { Router } from "express";
import { pool } from "../config/db.js";
import { getGitHubRateLimitStatus } from "../services/github.service.js";

const router = Router();

router.get("/", async (req, res) => {
  let dbStatus = "disconnected";
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const rateLimit = getGitHubRateLimitStatus();
  const overallStatus = dbStatus === "connected" ? "healthy" : "degraded";

  res.status(overallStatus === "healthy" ? 200 : 503).json({
    status: overallStatus,
    database: dbStatus,
    github: rateLimit.remaining === null ? "unknown" : rateLimit.remaining > 0 ? "available" : "rate_limited",
    githubRateLimitRemaining: rateLimit.remaining,
    timestamp: new Date().toISOString(),
  });
});

export default router;
