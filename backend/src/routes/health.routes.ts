import { Router } from "express";
import { testDatabaseConnection } from "../config/database";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const dbHealthy = await testDatabaseConnection();
    res.json({
      status: "healthy",
      database: dbHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: "unhealthy",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/", (_req, res) => {
  res.json({
    service: "SheetDB Sync",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      webhook: "/webhook/sheet",
      dashboard: "/admin/queues",
    },
  });
});

export default router;
