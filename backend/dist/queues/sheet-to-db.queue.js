"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheetToDbQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.sheetToDbQueue = new bullmq_1.Queue("sheet-to-db", {
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
