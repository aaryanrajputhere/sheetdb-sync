import IORedis from "ioredis";
import { env } from "./env";

export const redisConnection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

export default redisConnection;
