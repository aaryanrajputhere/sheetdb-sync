"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const worker = new bullmq_1.Worker("sheet-sync", async (job) => {
    const change = job.data;
    console.log("🔄 Processing sheet job for row:", change.rowId);
    // 🔜 Next step: Write to MySQL dynamically
}, { connection: redis_1.redisConnection });
worker.on("completed", (job) => {
    console.log("✅ Job completed:", job.id);
});
worker.on("failed", (job, err) => {
    console.error("❌ Job failed:", err);
});
