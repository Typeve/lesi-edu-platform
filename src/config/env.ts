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

const parseBoundedInteger = ({
  name,
  value,
  min,
  max
}: {
  name: string;
  value: string;
  min: number;
  max: number;
}): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid environment variable: ${name} must be an integer between ${min} and ${max}`);
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

  return trimmed;
};

const port = parsePort("PORT", process.env.PORT ?? "3000");
const dbPort = parsePort("DB_PORT", process.env.DB_PORT as string);

const jwtExpiresInDays = parseBoundedInteger({
  name: "JWT_EXPIRES_IN_DAYS",
  value: process.env.JWT_EXPIRES_IN_DAYS as string,
  min: 1,
  max: 30
});

const metricsCacheTtlSeconds = parseBoundedInteger({
  name: "METRICS_CACHE_TTL_SECONDS",
  value: process.env.METRICS_CACHE_TTL_SECONDS ?? "300",
  min: 1,
  max: 3600
});

const rawCacheInvalidationStrategy = (process.env.METRICS_CACHE_INVALIDATION_STRATEGY ?? "ttl").trim();
if (
  rawCacheInvalidationStrategy !== "ttl" &&
  rawCacheInvalidationStrategy !== "disabled"
) {
  throw new Error(
    "Invalid environment variable: METRICS_CACHE_INVALIDATION_STRATEGY must be ttl or disabled"
  );
}

const metricsSlowQueryThresholdMs = parseBoundedInteger({
  name: "METRICS_SLOW_QUERY_THRESHOLD_MS",
  value: process.env.METRICS_SLOW_QUERY_THRESHOLD_MS ?? "200",
  min: 1,
  max: 60000
});

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
  ADMIN_API_KEY: adminApiKey,
  METRICS_CACHE_TTL_SECONDS: metricsCacheTtlSeconds,
  METRICS_CACHE_INVALIDATION_STRATEGY: rawCacheInvalidationStrategy as "ttl" | "disabled",
  METRICS_SLOW_QUERY_THRESHOLD_MS: metricsSlowQueryThresholdMs
};
