"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.testDatabaseConnection = testDatabaseConnection;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("./env");
exports.pool = promise_1.default.createPool({
    host: env_1.env.DB_HOST,
    user: env_1.env.DB_USER,
    password: env_1.env.DB_PASSWORD,
    database: env_1.env.DB_NAME,
    port: env_1.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
async function testDatabaseConnection() {
    try {
        const [rows] = await exports.pool.query("SELECT 1 as ok");
        console.log("✅ Database connected");
        return true;
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
        return false;
    }
}
