import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const VALID_JWT_SECRET = "jwt_secret_0123456789_abcdefghijklmnopqrstuvwxyz";
const VALID_ADMIN_KEY = "admin_key_0123456789_abcdefghijklmnopqrstuvwxyz";

const runEnvModule = (extraEnv: Record<string, string>) => {
  const env = {
    ...process.env,
    PORT: "3000",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "root",
    DB_PASSWORD: "password",
    DB_NAME: "lesi_edu",
    JWT_SECRET: VALID_JWT_SECRET,
    ADMIN_API_KEY: VALID_ADMIN_KEY,
    JWT_EXPIRES_IN_DAYS: "7",
    ...extraEnv
  };

  return execFileSync(
    "node",
    ["--import", "tsx", "-e", "import './src/config/env.ts'; console.log('ENV_OK')"],
    {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
};

test("env validation should reject placeholder secret values", () => {
  assert.throws(
    () =>
      runEnvModule({
        JWT_SECRET: "replace_with_long_random_secret",
        ADMIN_API_KEY: "replace_with_admin_api_key"
      }),
    /cannot use placeholder value/
  );
});

test("env validation should allow short jwt secret", () => {
  const output = runEnvModule({
    JWT_SECRET: "short-secret"
  });

  assert.match(output, /ENV_OK/);
});

test("env validation should allow short admin api key", () => {
  const output = runEnvModule({
    ADMIN_API_KEY: "short-admin-key"
  });

  assert.match(output, /ENV_OK/);
});

test("env validation should reject unsupported metrics cache invalidation strategy", () => {
  assert.throws(
    () =>
      runEnvModule({
        METRICS_CACHE_INVALIDATION_STRATEGY: "unknown"
      }),
    /METRICS_CACHE_INVALIDATION_STRATEGY must be ttl or disabled/
  );
});

test("env validation should reject invalid slow query threshold", () => {
  assert.throws(
    () =>
      runEnvModule({
        METRICS_SLOW_QUERY_THRESHOLD_MS: "0"
      }),
    /METRICS_SLOW_QUERY_THRESHOLD_MS must be an integer between 1 and 60000/
  );
});
