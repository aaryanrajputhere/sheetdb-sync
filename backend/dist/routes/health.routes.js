"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get("/health", async (_req, res) => {
    try {
        const dbHealthy = await (0, database_1.testDatabaseConnection)();
        res.json({
            status: "healthy",
            database: dbHealthy ? "connected" : "disconnected",
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
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
exports.default = router;
