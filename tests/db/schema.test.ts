import test from "node:test";
import assert from "node:assert/strict";
import {
  activities,
  authScopes,
  auditLogs,
  certificates,
  profiles,
  reports,
  roleScopes,
  roles,
  students,
  tasks,
  teacherClassGrants,
  teacherStudentGrants
} from "../../src/db/schema.ts";

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

test("schema should include resource and grant authorization tables", () => {
  assert.equal(reports[Symbol.for("drizzle:Name")], "reports");
  assert.equal(tasks[Symbol.for("drizzle:Name")], "tasks");
  assert.equal(certificates[Symbol.for("drizzle:Name")], "certificates");
  assert.equal(profiles[Symbol.for("drizzle:Name")], "profiles");
  assert.equal(teacherStudentGrants[Symbol.for("drizzle:Name")], "teacher_student_grants");
  assert.equal(teacherClassGrants[Symbol.for("drizzle:Name")], "teacher_class_grants");

  assert.equal(reports.studentId.name, "student_id");
  assert.equal(tasks.studentId.name, "student_id");
  assert.equal(certificates.studentId.name, "student_id");
  assert.equal(profiles.studentId.name, "student_id");
  assert.equal(teacherStudentGrants.teacherId.name, "teacher_id");
  assert.equal(teacherClassGrants.classId.name, "class_id");
});

test("schema should include activity and audit log tables", () => {
  assert.equal(activities[Symbol.for("drizzle:Name")], "activities");
  assert.equal(auditLogs[Symbol.for("drizzle:Name")], "audit_logs");

  assert.equal(activities.activityType.name, "activity_type");
  assert.equal(activities.title.name, "title");

  assert.equal(auditLogs.operator.name, "operator");
  assert.equal(auditLogs.action.name, "action");
  assert.equal(auditLogs.target.name, "target");
  assert.equal(auditLogs.createdAt.name, "created_at");
});
