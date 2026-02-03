import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { SheetToDbJobData } from "../types";
import { mysqlService } from "../services/mysql.service";

export const sheetToDbWorker = new Worker<SheetToDbJobData>(
  "sheet-to-db",
  async (job) => {
    console.log(
      `🔄 [Sheet→DB] Received job data:`,
      JSON.stringify(job.data, null, 2),
    );

    const { action, data, version, rowId } = job.data;

    if (!data) {
      throw new Error("Missing 'data' field in job payload");
    }

    if (!rowId) {
      throw new Error("Missing rowId in job payload");
    }

    console.log(`🔄 [Sheet→DB] Processing ${action} for rowId ${rowId}:`, data);

    try {
      if (action === "insert") {
        // Use the ID from the sheet data, or generate one if not present
        const userId = data.id || rowId;
        
        // Remove 'id' from data as it's passed separately
        const { id: _, ...userData } = data;
        
        const id = await mysqlService.createUserDynamic(
          "users",
          userId,
          userData,
          version,
          "sheet"
        );
        console.log(`✅ [Sheet→DB] Inserted user with ID: ${id}`);
        return { success: true, id, action };
      } else if (action === "update") {
        // Use the ID from the sheet data to find and update the record
        const userId = data.id || rowId;
        const existing = await mysqlService.getUserById(userId);

        if (!existing) {
          // If record doesn't exist, treat as insert
          console.log(
            `ℹ️ [Sheet→DB] No record found for ID ${userId}, treating as insert`,
          );
          
          // Remove 'id' from data as it's passed separately
          const { id: _, ...userData } = data;
          
          const id = await mysqlService.createUserDynamic(
            "users",
            userId,
            userData,
            version,
            "sheet"
          );
          console.log(`✅ [Sheet→DB] Inserted user with ID: ${id}`);
          return { success: true, id, action: "insert" };
        }

        // Check version conflict
        if (existing.version > version) {
          console.warn(
            `⚠️ [Sheet→DB] Version conflict: DB has v${existing.version}, incoming v${version}`,
          );
          throw new Error("Version conflict - DB has newer data");
        }

        // Remove 'id' from data as it's passed separately
        const { id: _, ...userData } = data;
        
        const updated = await mysqlService.updateUserDynamic(
          "users",
          userId,
          userData,
          version + 1,
          "sheet"
        );
        console.log(`✅ [Sheet→DB] Updated user ID: ${userId}`);
        return { success: true, id: userId, action };
      } else if (action === "delete") {
        const userId = data.id || rowId;
        const deleted = await mysqlService.deleteUser(userId);
        console.log(`✅ [Sheet→DB] Deleted user ID: ${userId}`);
        return { success: true, id: userId, action };
      }

      throw new Error(`Invalid action: ${action}`);
    } catch (error) {
      console.error(`❌ [Sheet→DB] Error processing job:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

sheetToDbWorker.on("completed", (job) => {
  console.log(`✅ [Sheet→DB] Job ${job.id} completed`);
});

sheetToDbWorker.on("failed", (job, err) => {
  console.error(`❌ [Sheet→DB] Job ${job?.id} failed:`, err.message);
});

console.log("🚀 Sheet→DB worker started");
