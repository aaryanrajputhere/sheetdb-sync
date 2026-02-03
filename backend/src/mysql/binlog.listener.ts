import MySQLEvents, { STATEMENTS } from "@rodrigogs/mysql-events";
import { dbToSheetQueue } from "../queues";
export async function startBinlogListener() {
  const instance = new MySQLEvents(
    {
      host: process.env.DB_HOST!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
    },
    {
      startAtEnd: true,
    },
  );

  await instance.start();

  instance.addTrigger({
    name: "users-table-sync",
    expression: `${process.env.DB_NAME}.users`,
    statement: STATEMENTS.ALL,
    onEvent: async (event: any) => {
      console.log("📦 BINLOG EVENT:", JSON.stringify(event, null, 2));

      const row = event.affectedRows?.[0]?.after;
      if (!row) return;

      // Determine action based on event type
      let action: "insert" | "update" | "delete";
      if (event.type === "INSERT") action = "insert";
      else if (event.type === "UPDATE") action = "update";
      else if (event.type === "DELETE") action = "delete";
      else return; // Unknown event type

      await dbToSheetQueue.add("db_to_sheet", {
        action,
        source: "db",
        table: "users",
        recordId: row.id,
        data: {
          name: row.name,
          age: row.age,
        },
        version: row.version,
        lastModifiedAt: row.last_modified_at,
      });
    },
  });

  console.log("✅ Binlog listener started");
}
