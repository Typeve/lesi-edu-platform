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
  assert.ok(entries.length >= 6, "journal should contain at least 6 entries");

  entries.forEach((entry, index) => {
    assert.equal(entry.idx, index, `journal idx should be continuous at ${index}`);
  });

  for (const prefix of ["0000", "0001", "0002", "0003", "0004", "0005"]) {
    assert.ok(
      entries.some((entry) => entry.tag.startsWith(`${prefix}_`)),
      `journal should include migration ${prefix}`
    );
  }

  const snapshot0004 = readJson(path.join(drizzleMetaDir, "0004_snapshot.json"));
  const snapshot0005 = readJson(path.join(drizzleMetaDir, "0005_snapshot.json"));

  assert.equal(
    snapshot0005.prevId,
    snapshot0004.id,
    "0005 snapshot prevId should point to 0004 snapshot id"
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

test("0004 migration file should exist and include activity and audit log tables", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0004 = migrationFiles.find((fileName) => /^0004_.*\.sql$/.test(fileName));

  assert.ok(migration0004, "expected a 0004 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0004), "utf8");

  for (const tableName of ["activities", "audit_logs"]) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TABLE\\s+\`${tableName}\``, "i"),
      `0004 migration should create table ${tableName}`
    );
  }
});

test("0005 migration file should exist and include certificate_files table", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0005 = migrationFiles.find((fileName) => /^0005_.*\.sql$/.test(fileName));

  assert.ok(migration0005, "expected a 0005 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0005), "utf8");

  assert.match(
    migrationSql,
    /CREATE TABLE\s+`certificate_files`/i,
    "0005 migration should create table certificate_files"
  );
});
