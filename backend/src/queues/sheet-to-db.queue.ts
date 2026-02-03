import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import { SheetToDbJobData } from "../types";

export const sheetToDbQueue = new Queue<SheetToDbJobData>("sheet-to-db", {
  connection: redisConnection,
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
