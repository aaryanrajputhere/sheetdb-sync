import { sheetsService } from "../services/sheets.service";
import { mysqlService } from "../services/mysql.service";
import { sheetToDbQueue } from "../queues";

export interface SchemaChangePayload {
  tableName: string;
  newHeaders: string[];
  sampleData?: Record<string, any>; // Sample row data to infer types
}

export async function handleSheetSchemaChange(
  payload: SchemaChangePayload,
): Promise<void> {
  const { tableName, newHeaders, sampleData } = payload;

  // Map sheet names to actual table names
  const tableNameMap: Record<string, string> = {
    sheet1: "users",
    // Add more mappings as needed
  };

  const actualTableName = tableNameMap[tableName.toLowerCase()] || tableName;

  console.log(
    `🔧 Processing schema change for sheet '${tableName}' -> table '${actualTableName}'`,
    newHeaders,
  );

  try {
    // Clear any pending failed jobs from the queue to prevent retries with old schema
    console.log("🧹 Cleaning up failed jobs from queue...");
    await sheetToDbQueue.clean(0, 1000, "failed");

    // Filter out system/reserved columns and empty column names
    const systemColumns = ["MIGRATING", "READY"];
    const filteredHeaders = newHeaders.filter(
      (col) =>
        col && col.trim() !== "" && !systemColumns.includes(col.toUpperCase()),
    );

    // Get current database schema
    const currentDbSchema = await mysqlService.getTableSchema(actualTableName);
    console.log(`📋 Current DB schema:`, currentDbSchema);
    console.log(`📋 New sheet schema:`, filteredHeaders);

    // Detect changes
    const changes = sheetsService.detectSchemaChanges(
      currentDbSchema,
      filteredHeaders,
    );
    console.log(`🔍 Detected changes:`, changes);

    // Handle renames
    for (const rename of changes.renamed) {
      await mysqlService.renameColumn(actualTableName, rename.from, rename.to);
    }

    // Handle added columns
    for (const columnName of changes.added) {
      // Infer type from sample data if available
      let columnType = "VARCHAR(255)";
      if (sampleData && sampleData[columnName]) {
        columnType = mysqlService.inferMySQLType(sampleData[columnName]);
      }

      // Sanitize column name for MySQL
      const safeColumnName = columnName
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .toLowerCase();
      await mysqlService.addColumn(actualTableName, safeColumnName, columnType);
    }

    // Handle removed columns
    for (const columnName of changes.removed) {
      try {
        await mysqlService.dropColumn(actualTableName, columnName);
      } catch (error) {
        console.warn(
          `⚠️ Could not drop column '${columnName}':`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Update the stored schema
    sheetsService.setCurrentSchema(filteredHeaders);

    console.log(`✅ Schema changes applied successfully`);
  } catch (error) {
    console.error(`❌ Error handling schema change:`, error);
    throw error;
  }
}
