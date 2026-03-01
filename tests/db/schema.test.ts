import test from "node:test";
import assert from "node:assert/strict";
import { authScopes, roleScopes, roles, students } from "../../src/db/schema.ts";

test("schema should expose role/scope association tables", () => {
  assert.equal(roles[Symbol.for("drizzle:Name")], "roles");
  assert.equal(authScopes[Symbol.for("drizzle:Name")], "auth_scopes");
  assert.equal(roleScopes[Symbol.for("drizzle:Name")], "role_scopes");
});

test("auth_scopes should support class_id and student_id authorization", () => {
  assert.equal(authScopes.classId.name, "class_id");
  assert.equal(authScopes.studentId.name, "student_id");
});

test("role_scopes should include role_id and scope_id", () => {
  assert.equal(roleScopes.roleId.name, "role_id");
  assert.equal(roleScopes.scopeId.name, "scope_id");
});

test("students should include password security fields", () => {
  assert.equal(students.passwordHash.name, "password_hash");
  assert.equal(students.mustChangePassword.name, "must_change_password");
  assert.equal(students.passwordUpdatedAt.name, "password_updated_at");
  assert.equal(students.mustChangePassword.notNull, true);
  assert.equal(students.mustChangePassword.hasDefault, true);
  assert.equal(students.passwordHash.notNull, false);
});
