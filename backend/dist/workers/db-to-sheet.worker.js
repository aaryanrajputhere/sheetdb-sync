"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbToSheetWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const sheets_service_1 = require("../services/sheets.service");
exports.dbToSheetWorker = new bullmq_1.Worker("db-to-sheet", async (job) => {
    const { action, recordId, data, version, lastModifiedAt } = job.data;
    console.log(`🔄 [DB→Sheet] Processing ${action} for record ID: ${recordId}`);
    try {
        const rowIndex = await sheets_service_1.sheetsService.findRowById(String(recordId));
        if (action === "insert" || (action === "update" && !rowIndex)) {
            // Insert new row
            await sheets_service_1.sheetsService.appendRow({
                id: recordId,
                name: data.name,
                age: data.age,
                version,
                source: "db",
                lastModifiedAt: String(lastModifiedAt),
            });
            console.log(`✅ [DB→Sheet] Inserted row for ID: ${recordId}`);
        }
        else if (action === "update" && rowIndex) {
            // Update existing row
            await sheets_service_1.sheetsService.updateRow(rowIndex, {
                id: recordId,
                name: data.name,
                age: data.age,
                version,
                source: "db",
                lastModifiedAt: String(lastModifiedAt),
            });
            console.log(`✅ [DB→Sheet] Updated row ${rowIndex} for ID: ${recordId}`);
        }
        else if (action === "delete" && rowIndex) {
            // Delete row
            await sheets_service_1.sheetsService.deleteRow(rowIndex);
            console.log(`✅ [DB→Sheet] Deleted row ${rowIndex} for ID: ${recordId}`);
        }
        return { success: true, recordId, action };
    }
    catch (error) {
        console.error(`❌ [DB→Sheet] Error processing job:`, error);
        throw error;
    }
}, {
    connection: redis_1.redisConnection,
    concurrency: 5,
});
exports.dbToSheetWorker.on("completed", (job) => {
    console.log(`✅ [DB→Sheet] Job ${job.id} completed`);
});
exports.dbToSheetWorker.on("failed", (job, err) => {
    console.error(`❌ [DB→Sheet] Job ${job?.id} failed:`, err.message);
});
console.log("🚀 DB→Sheet worker started");
