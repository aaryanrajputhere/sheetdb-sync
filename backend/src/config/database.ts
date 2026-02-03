import mysql from "mysql2/promise";
import { env } from "./env";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const [rows] = await pool.query("SELECT 1 as ok");
    console.log("✅ Database connected");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}
