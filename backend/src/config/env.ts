import dotenv from "dotenv";
dotenv.config();

interface EnvConfig {
  PORT: number;
  DB_HOST: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_PORT: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
  SHEET_ID?: string;
}

function validateEnv(): EnvConfig {
  const requiredVars = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "DB_PORT",
    "REDIS_HOST",
    "REDIS_PORT",
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    PORT: Number(process.env.PORT) || 4000,
    DB_HOST: process.env.DB_HOST!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
    DB_NAME: process.env.DB_NAME!,
    DB_PORT: Number(process.env.DB_PORT!),
    REDIS_HOST: process.env.REDIS_HOST!,
    REDIS_PORT: Number(process.env.REDIS_PORT!),
    SHEET_ID: process.env.SHEET_ID,
  };
}

export const env = validateEnv();
