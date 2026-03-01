import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const runEnvModule = (extraEnv: Record<string, string>) => {
  const env = {
    ...process.env,
    PORT: "3000",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_USER: "root",
    DB_PASSWORD: "password",
    DB_NAME: "lesi_edu",
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
