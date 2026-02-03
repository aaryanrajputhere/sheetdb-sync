import express from "express";
import { env } from "./config/env";
import { testDatabaseConnection } from "./config/database";
import routes from "./routes";
import { setupBullBoard } from "./dashboard/bullBoard";
import { startBinlogListener } from "./listeners/binlog.listener";
import { initializeSheetHeader } from "./utils/initializeSheet";
import "./workers"; // Initialize all workers

const app = express();
app.use(express.json());

// Routes
app.use("/", routes);

// Bull Board Dashboard
setupBullBoard(app);

// Initialize services
async function startServer() {
  try {
    // Test database connection
    await testDatabaseConnection();

    // Initialize Google Sheets header with current schema
    if (env.SHEET_ID) {
      await initializeSheetHeader("users");
    }

    // Start binlog listener
    await startBinlogListener();

    // Start Express server
    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
      console.log(
        `📊 Dashboard available at http://localhost:${env.PORT}/admin/queues`,
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
