import MySQLEvents, { STATEMENTS } from "@rodrigogs/mysql-events";
import { env } from "../config/env";
import { dbToSheetQueue } from "../queues";
import { mysqlService } from "../services/mysql.service";
import { sheetsService } from "../services/sheets.service";

async function handleSchemaChange(tableName: string) {
  console.log(`🔧 Schema change detected for table: ${tableName}`);

  try {
    // 1. Get old schema before updating
    const oldSchema = sheetsService.getCurrentSchema();

    // 2. Get the new schema from MySQL
    const newSchema = await mysqlService.getTableSchema(tableName);
    console.log(`📋 Old schema:`, oldSchema);
    console.log(`📋 New schema:`, newSchema);

    // 3. Update Google Sheets header row
    await sheetsService.updateHeaderRow(newSchema);

    // 4. Migrate existing data to match new schema
    if (oldSchema.length > 0) {
      await sheetsService.migrateExistingData(oldSchema, newSchema);
    }

    // 5. Update the current schema in memory
    sheetsService.setCurrentSchema(newSchema);

    console.log(`✅ Schema change handled successfully`);
  } catch (error) {
    console.error(`❌ Error handling schema change:`, error);
  }
}

export async function startBinlogListener() {
  const instance = new MySQLEvents(
    {
      host: env.DB_HOST,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    {
      startAtEnd: true,
    },
  );

  await instance.start();

  // Initialize schema on startup
  try {
    const columns = await mysqlService.getTableSchema("users");
    sheetsService.setCurrentSchema(columns);
    console.log(`📋 Initialized schema with columns:`, columns);
  } catch (error) {
    console.error(`⚠️ Could not initialize schema:`, error);
  }

  instance.addTrigger({
    name: "users-table-sync",
    expression: `${env.DB_NAME}.users`,
    statement: STATEMENTS.ALL,
    onEvent: async (event: any) => {
      console.log("📦 BINLOG EVENT:", JSON.stringify(event, null, 2));

      // Check if this is a schema change event (ALTER TABLE only)
      if (event.type === "ALTER") {
        await handleSchemaChange("users");
        return;
      }

      const row = event.affectedRows?.[0]?.after;
      const eventType = event.type;

      if (!row && eventType !== "DELETE") return;

      // 🛑 PREVENT INFINITE LOOP: Skip changes that originated from the sheet
      // Allow NULL source (manual SQL inserts) and "db" source to sync to sheet
      const source = row?.source || event.affectedRows?.[0]?.before?.source;
      if (source === "sheet") {
        console.log(`⏭️ Skipping binlog event for row ${row?.id || event.affectedRows?.[0]?.before?.id} - originated from sheet`);
        return;
      }

      let action: "insert" | "update" | "delete" = "update";
      if (eventType === "INSERT") action = "insert";
      else if (eventType === "DELETE") action = "delete";

      const recordId = row?.id || event.affectedRows?.[0]?.before?.id;

      // Get current schema to extract all column data dynamically
      const currentSchema = sheetsService.getCurrentSchema();
      const data: Record<string, any> = {};

      // Extract all data from the row, excluding system columns
      const systemColumns = ["id", "version", "source", "last_modified_at"];
      currentSchema.forEach((column) => {
        if (!systemColumns.includes(column) && row) {
          data[column] = row[column] !== undefined ? row[column] : null;
        }
      });

      await dbToSheetQueue.add("db-change", {
        action,
        source: "db",
        table: "users",
        recordId,
        data: data as any,
        version: row?.version || 1,
        lastModifiedAt: row?.last_modified_at || new Date().toISOString(),
      });

      console.log(`📥 Enqueued ${action} for record ID: ${recordId}`);
    },
  });

  console.log("✅ Binlog listener started");
}
