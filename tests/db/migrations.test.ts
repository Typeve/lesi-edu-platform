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
  assert.ok(entries.length >= 10, "journal should contain at least 10 entries");

  entries.forEach((entry, index) => {
    assert.equal(entry.idx, index, `journal idx should be continuous at ${index}`);
  });

  for (const prefix of ["0000", "0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008", "0009"]) {
    assert.ok(
      entries.some((entry) => entry.tag.startsWith(`${prefix}_`)),
      `journal should include migration ${prefix}`
    );
  }

  const snapshot0005 = readJson(path.join(drizzleMetaDir, "0005_snapshot.json"));
  const snapshot0006 = readJson(path.join(drizzleMetaDir, "0006_snapshot.json"));

  assert.equal(
    snapshot0006.prevId,
    snapshot0005.id,
    "0006 snapshot prevId should point to 0005 snapshot id"
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

test("0006 migration file should include major dimension and report direction updates", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0006 = migrationFiles.find((fileName) => /^0006_.*\.sql$/.test(fileName));

  assert.ok(migration0006, "expected a 0006 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0006), "utf8");

  assert.match(migrationSql, /CREATE TABLE\s+`majors`/i);
  assert.match(migrationSql, /ADD\s+`major_id`\s+int/i);
  assert.match(migrationSql, /ADD\s+`direction`/i);
});

test("0007 migration file should include student first-login verification fields", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0007 = migrationFiles.find((fileName) => /^0007_.*\.sql$/.test(fileName));

  assert.ok(migration0007, "expected a 0007 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0007), "utf8");

  assert.match(migrationSql, /ADD\s+`credential_no`\s+varchar\(32\)/i);
  assert.match(migrationSql, /ADD\s+`first_login_verified_at`\s+timestamp/i);
});

test("0008 migration file should include enrollment_profiles source table", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0008 = migrationFiles.find((fileName) => /^0008_.*\.sql$/.test(fileName));

  assert.ok(migration0008, "expected a 0008 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0008), "utf8");

  assert.match(migrationSql, /CREATE TABLE\s+`enrollment_profiles`/i);
  assert.match(migrationSql, /`student_no`\s+varchar\(32\)\s+NOT\s+NULL/i);
  assert.match(migrationSql, /`score`\s+int/i);
  assert.match(migrationSql, /`admission_year`\s+int/i);
});

test("0009 migration file should include assessment_submissions table", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0009 = migrationFiles.find((fileName) => /^0009_.*\.sql$/.test(fileName));

  assert.ok(migration0009, "expected a 0009 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0009), "utf8");

  assert.match(migrationSql, /CREATE TABLE\s+`assessment_submissions`/i);
  assert.match(migrationSql, /`student_id`\s+int\s+NOT\s+NULL/i);
  assert.match(migrationSql, /`answers_json`\s+text\s+NOT\s+NULL/i);
  assert.match(migrationSql, /UNIQUE\(`student_id`\)/i);
});

test("0010 migration file should include report_generation_jobs table", () => {
  const migrationFiles = fs.readdirSync(drizzleDir);
  const migration0010 = migrationFiles.find((fileName) => /^0010_.*\.sql$/.test(fileName));

  assert.ok(migration0010, "expected a 0010 migration SQL file");

  const migrationSql = fs.readFileSync(path.join(drizzleDir, migration0010), "utf8");

  assert.match(migrationSql, /CREATE TABLE\s+`report_generation_jobs`/i);
  assert.match(migrationSql, /`student_no`\s+varchar\(32\)\s+NOT\s+NULL/i);
  assert.match(migrationSql, /`payload_json`\s+text\s+NOT\s+NULL/i);
  assert.match(migrationSql, /`status`\s+varchar\(16\)\s+NOT\s+NULL/i);
});
