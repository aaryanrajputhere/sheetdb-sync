"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const routes_1 = __importDefault(require("./routes"));
const bullBoard_1 = require("./dashboard/bullBoard");
const binlog_listener_1 = require("./listeners/binlog.listener");
require("./workers"); // Initialize all workers
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Routes
app.use("/", routes_1.default);
// Bull Board Dashboard
(0, bullBoard_1.setupBullBoard)(app);
// Initialize services
async function startServer() {
    try {
        // Test database connection
        await (0, database_1.testDatabaseConnection)();
        // Start binlog listener
        await (0, binlog_listener_1.startBinlogListener)();
        // Start Express server
        app.listen(env_1.env.PORT, () => {
            console.log(`🚀 Server running on port ${env_1.env.PORT}`);
            console.log(`📊 Dashboard available at http://localhost:${env_1.env.PORT}/admin/queues`);
        });
    }
    catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}
startServer();
