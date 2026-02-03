import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { DbToSheetJobData } from "../types";
import { sheetsService } from "../services/sheets.service";

export const dbToSheetWorker = new Worker<DbToSheetJobData>(
  "db-to-sheet",
  async (job) => {
    const { action, recordId, data, version, lastModifiedAt } = job.data;

    console.log(
      `🔄 [DB→Sheet] Processing ${action} for record ID: ${recordId}`,
    );

    try {
      const rowIndex = await sheetsService.findRowById(String(recordId));

      // Check if we should use dynamic methods based on schema
      const currentSchema = sheetsService.getCurrentSchema();
      const useDynamic = currentSchema.length > 0;

      if (action === "insert" || (action === "update" && !rowIndex)) {
        // Insert new row
        if (useDynamic) {
          const dynamicData: Record<string, any> = {
            id: recordId,
            version,
            source: "db",
            last_modified_at: String(lastModifiedAt),
            ...data,
          };
          await sheetsService.appendRowDynamic(dynamicData);
        } else {
          await sheetsService.appendRow({
            id: recordId,
            name: data.name,
            age: data.age,
            version,
            source: "db",
            lastModifiedAt: String(lastModifiedAt),
          });
        }
        console.log(`✅ [DB→Sheet] Inserted row for ID: ${recordId}`);
      } else if (action === "update" && rowIndex) {
        // Update existing row
        if (useDynamic) {
          const dynamicData: Record<string, any> = {
            id: recordId,
            version,
            source: "db",
            last_modified_at: String(lastModifiedAt),
            ...data,
          };
          await sheetsService.updateRowDynamic(rowIndex, dynamicData);
        } else {
          await sheetsService.updateRow(rowIndex, {
            id: recordId,
            name: data.name,
            age: data.age,
            version,
            source: "db",
            lastModifiedAt: String(lastModifiedAt),
          });
        }
        console.log(
          `✅ [DB→Sheet] Updated row ${rowIndex} for ID: ${recordId}`,
        );
      } else if (action === "delete" && rowIndex) {
        // Delete row
        await sheetsService.deleteRow(rowIndex);
        console.log(
          `✅ [DB→Sheet] Deleted row ${rowIndex} for ID: ${recordId}`,
        );
      }

      return { success: true, recordId, action };
    } catch (error) {
      console.error(`❌ [DB→Sheet] Error processing job:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

dbToSheetWorker.on("completed", (job) => {
  console.log(`✅ [DB→Sheet] Job ${job.id} completed`);
});

dbToSheetWorker.on("failed", (job, err) => {
  console.error(`❌ [DB→Sheet] Job ${job?.id} failed:`, err.message);
});

console.log("🚀 DB→Sheet worker started");
