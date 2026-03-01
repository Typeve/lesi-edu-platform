import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../..");
const drizzleDir = path.join(repoRoot, "drizzle");

test("0002 migration should make students.password_hash nullable", () => {
  const migrationFiles = fs
    .readdirSync(drizzleDir)
    .filter((fileName) => /^0002_.*\.sql$/.test(fileName));

  assert.equal(
    migrationFiles.length,
    1,
    "expected exactly one 0002 migration SQL file"
  );

  const migrationSql = fs.readFileSync(
    path.join(drizzleDir, migrationFiles[0]),
    "utf8"
  );

  assert.match(
    migrationSql,
    /ALTER TABLE\s+`students`\s+MODIFY\s+`password_hash`\s+varchar\(255\)/i
  );
  assert.doesNotMatch(
    migrationSql,
    /`password_hash`\s+varchar\(255\)\s+NOT\s+NULL/i
  );
});
