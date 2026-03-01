import { config } from "dotenv";

config();

const REQUIRED_KEYS = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
  "JWT_EXPIRES_IN_DAYS",
  "ADMIN_API_KEY"
] as const;

for (const key of REQUIRED_KEYS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const jwtExpiresInDays = Number(process.env.JWT_EXPIRES_IN_DAYS);
if (!Number.isInteger(jwtExpiresInDays) || jwtExpiresInDays <= 0) {
  throw new Error("Invalid environment variable: JWT_EXPIRES_IN_DAYS must be a positive integer");
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  DB_HOST: process.env.DB_HOST as string,
  DB_PORT: Number(process.env.DB_PORT),
  DB_USER: process.env.DB_USER as string,
  DB_PASSWORD: process.env.DB_PASSWORD as string,
  DB_NAME: process.env.DB_NAME as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRES_IN_DAYS: jwtExpiresInDays,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY as string
};
