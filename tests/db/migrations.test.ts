import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../..");
const drizzleDir = path.join(repoRoot, "drizzle");
const drizzleMetaDir = path.join(drizzleDir, "meta");

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("drizzle migration metadata chain should be continuous", () => {
  const journal = readJson(path.join(drizzleMetaDir, "_journal.json"));
  const entries = journal.entries as Array<{ idx: number; tag: string }>;

  assert.ok(Array.isArray(entries), "journal entries should be an array");
  assert.ok(entries.length >= 4, "journal should contain at least 4 entries");

  entries.forEach((entry, index) => {
    assert.equal(entry.idx, index, `journal idx should be continuous at ${index}`);
  });

  for (const prefix of ["0000", "0001", "0002", "0003"]) {
    assert.ok(
      entries.some((entry) => entry.tag.startsWith(`${prefix}_`)),
      `journal should include migration ${prefix}`
    );
  }

  const snapshot0002 = readJson(path.join(drizzleMetaDir, "0002_snapshot.json"));
  const snapshot0003 = readJson(path.join(drizzleMetaDir, "0003_snapshot.json"));

  assert.equal(
    snapshot0003.prevId,
    snapshot0002.id,
    "0003 snapshot prevId should point to 0002 snapshot id"
  );
});

test("0001 and 0002 migration files should exist and 0002 should make password_hash nullable", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0001 = migrationFiles.find((fileName) => /^0001_.*\.sql$/.test(fileName));
  const migration0002 = migrationFiles.find((fileName) => /^0002_.*\.sql$/.test(fileName));

  assert.ok(migration0001, "expected a 0001 migration SQL file");
  assert.ok(migration0002, "expected a 0002 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0002), "utf8");

  assert.match(
    migrationSql,
    /ALTER TABLE\s+`students`\s+MODIFY\s+`password_hash`\s+varchar\(255\)/i
  );
  assert.doesNotMatch(
    migrationSql,
    /`password_hash`\s+varchar\(255\)\s+NOT\s+NULL/i,
    "0002 migration should not keep password_hash as NOT NULL"
  );
});

test("0003 migration file should exist and include resource authorization tables", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0003 = migrationFiles.find((fileName) => /^0003_.*\.sql$/.test(fileName));

  assert.ok(migration0003, "expected a 0003 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0003), "utf8");

  for (const tableName of [
    "reports",
    "tasks",
    "certificates",
    "profiles",
    "teacher_student_grants",
    "teacher_class_grants"
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TABLE\\s+\`${tableName}\``, "i"),
      `0003 migration should create table ${tableName}`
    );
  }
});
