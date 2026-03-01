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

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_VALUES = new Set([
  "replace_with_long_random_secret",
  "replace_with_admin_api_key"
]);

const parsePort = (name: "PORT" | "DB_PORT", value: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid environment variable: ${name} must be an integer between 1 and 65535`);
  }

  return parsed;
};

const validateSecretLike = (name: "JWT_SECRET" | "ADMIN_API_KEY", value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid environment variable: ${name} cannot be empty`);
  }

  if (PLACEHOLDER_VALUES.has(trimmed)) {
    throw new Error(`Invalid environment variable: ${name} cannot use placeholder value`);
  }

  if (trimmed.length < MIN_SECRET_LENGTH) {
    throw new Error(`Invalid environment variable: ${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  return trimmed;
};

const port = parsePort("PORT", process.env.PORT ?? "3000");
const dbPort = parsePort("DB_PORT", process.env.DB_PORT as string);

const jwtExpiresInDays = Number(process.env.JWT_EXPIRES_IN_DAYS);
if (!Number.isInteger(jwtExpiresInDays) || jwtExpiresInDays <= 0 || jwtExpiresInDays > 30) {
  throw new Error("Invalid environment variable: JWT_EXPIRES_IN_DAYS must be an integer between 1 and 30");
}

const jwtSecret = validateSecretLike("JWT_SECRET", process.env.JWT_SECRET as string);
const adminApiKey = validateSecretLike("ADMIN_API_KEY", process.env.ADMIN_API_KEY as string);

export const env = {
  PORT: port,
  DB_HOST: process.env.DB_HOST as string,
  DB_PORT: dbPort,
  DB_USER: process.env.DB_USER as string,
  DB_PASSWORD: process.env.DB_PASSWORD as string,
  DB_NAME: process.env.DB_NAME as string,
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN_DAYS: jwtExpiresInDays,
  ADMIN_API_KEY: adminApiKey
};
