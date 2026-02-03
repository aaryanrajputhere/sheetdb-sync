"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheetToDbWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const mysql_service_1 = require("../services/mysql.service");
exports.sheetToDbWorker = new bullmq_1.Worker("sheet-to-db", async (job) => {
    console.log(`🔄 [Sheet→DB] Received job data:`, JSON.stringify(job.data, null, 2));
    const { action, data, version } = job.data;
    if (!data) {
        throw new Error("Missing 'data' field in job payload");
    }
    console.log(`🔄 [Sheet→DB] Processing ${action} for data:`, data);
    try {
        if (action === "insert") {
            const id = await mysql_service_1.mysqlService.createUser({
                name: data.name,
                age: data.age,
                version,
                source: "sheet",
            });
            console.log(`✅ [Sheet→DB] Inserted user with ID: ${id}`);
            return { success: true, id, action };
        }
        else if (action === "update") {
            if (!data.id) {
                throw new Error("Missing ID for update action");
            }
            // Check version conflict
            const existing = await mysql_service_1.mysqlService.getUserById(data.id);
            if (existing && existing.version > version) {
                console.warn(`⚠️ [Sheet→DB] Version conflict: DB has v${existing.version}, incoming v${version}`);
                throw new Error("Version conflict - DB has newer data");
            }
            const updated = await mysql_service_1.mysqlService.updateUser(data.id, {
                name: data.name,
                age: data.age,
                version: version + 1,
                source: "sheet",
            });
            console.log(`✅ [Sheet→DB] Updated user ID: ${data.id}`);
            return { success: true, id: data.id, action };
        }
        else if (action === "delete") {
            if (!data.id) {
                throw new Error("Missing ID for delete action");
            }
            const deleted = await mysql_service_1.mysqlService.deleteUser(data.id);
            console.log(`✅ [Sheet→DB] Deleted user ID: ${data.id}`);
            return { success: true, id: data.id, action };
        }
        throw new Error(`Invalid action: ${action}`);
    }
    catch (error) {
        console.error(`❌ [Sheet→DB] Error processing job:`, error);
        throw error;
    }
}, {
    connection: redis_1.redisConnection,
    concurrency: 5,
});
exports.sheetToDbWorker.on("completed", (job) => {
    console.log(`✅ [Sheet→DB] Job ${job.id} completed`);
});
exports.sheetToDbWorker.on("failed", (job, err) => {
    console.error(`❌ [Sheet→DB] Job ${job?.id} failed:`, err.message);
});
console.log("🚀 Sheet→DB worker started");
