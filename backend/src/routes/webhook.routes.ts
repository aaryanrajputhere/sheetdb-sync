import { Router } from "express";
import { sheetToDbQueue } from "../queues";
import { handleSheetSchemaChange } from "../handlers/schema-change.handler";

const router = Router();

router.post("/sheet", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📬 Received sheet change:", JSON.stringify(payload, null, 2));

    // Map Google Apps Script payload to internal format
    const action: "insert" | "update" | "delete" =
      payload.operation === "INSERT" ? "insert" : "update";

    // Extract all data from dataAfter, excluding system columns
    const data: Record<string, any> = {};
    if (payload.dataAfter) {
      const systemColumns = [
        "id",
        "version",
        "_last_modified_at",
        "MIGRATING",
        "READY",
      ];
      Object.keys(payload.dataAfter).forEach((key) => {
        // Filter out system columns, empty keys, and migration flags
        if (
          key &&
          key.trim() !== "" &&
          !systemColumns.includes(key) &&
          !systemColumns.includes(key.toUpperCase())
        ) {
          data[key] = payload.dataAfter[key];
        }
      });
    }

    await sheetToDbQueue.add("sheet-change", {
      action,
      source: "sheet",
      rowId: payload.rowId, // UUID from Google Sheets
      data: data as any,
      version: payload.version || 1,
      lastModifiedAt: payload.timestamp || new Date().toISOString(),
    });

    console.log(`📥 Enqueued ${action} for row:`, payload.rowId);

    res.json({
      status: "queued",
      message: "Sheet change queued for processing",
      rowId: payload.rowId,
    });
  } catch (error) {
    console.error("❌ Error queuing sheet change:", error);
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/schema-change", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔧 Received schema change:", JSON.stringify(payload, null, 2));

    // Validate payload
    if (!payload.tableName || !payload.newHeaders) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: tableName, newHeaders",
      });
    }

    // Process schema change
    await handleSheetSchemaChange({
      tableName: payload.tableName,
      newHeaders: payload.newHeaders,
      sampleData: payload.sampleData,
    });

    res.json({
      status: "success",
      message: "Schema changes applied successfully",
      tableName: payload.tableName,
    });
  } catch (error) {
    console.error("❌ Error processing schema change:", error);
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
