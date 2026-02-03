"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queues_1 = require("../queues");
const router = (0, express_1.Router)();
router.post("/sheet", async (req, res) => {
    try {
        const payload = req.body;
        console.log("📬 Received sheet change:", JSON.stringify(payload, null, 2));
        // Map Google Apps Script payload to internal format
        const action = payload.operation === "INSERT" ? "insert" : "update";
        const data = {
            id: payload.dataAfter?.id || null, // Database ID from the sheet
            name: payload.dataAfter?.name || "",
            age: payload.dataAfter?.age || 0,
        };
        await queues_1.sheetToDbQueue.add("sheet-change", {
            action,
            source: "sheet",
            rowId: payload.rowId, // UUID from Google Sheets
            data,
            version: payload.version || 1,
            lastModifiedAt: payload.timestamp || new Date().toISOString(),
        });
        console.log(`📥 Enqueued ${action} for row:`, payload.rowId);
        res.json({
            status: "queued",
            message: "Sheet change queued for processing",
            rowId: payload.rowId,
        });
    }
    catch (error) {
        console.error("❌ Error queuing sheet change:", error);
        res.status(500).json({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.default = router;
