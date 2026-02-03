"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbToSheetQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.dbToSheetQueue = new bullmq_1.Queue("db-to-sheet", {
    connection: redis_1.redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: {
            count: 100,
            age: 24 * 3600, // 24 hours
        },
        removeOnFail: false,
    },
});
