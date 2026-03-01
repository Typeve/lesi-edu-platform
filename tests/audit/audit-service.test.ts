import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuditLogService,
  type AuditLogRepository,
  type PersistAuditLogInput
} from "../../src/modules/audit/service.ts";

interface AuditFixture {
  logs: PersistAuditLogInput[];
}

const createRepository = (fixture: AuditFixture): AuditLogRepository => ({
  async createAuditLog(input) {
    fixture.logs.push(input);
  }
});

test("audit service should write logs for grant/revoke/reset/publish with operator target action time", async () => {
  const fixture: AuditFixture = {
    logs: []
  };

  const service = createAuditLogService({
    auditLogRepo: createRepository(fixture)
  });

  await service.logAuthorizationGrant({
    operator: "admin-1",
    teacherId: "teacher-101",
    grantType: "student",
    targetId: 11
  });

  await service.logAuthorizationRevoke({
    operator: "admin-1",
    teacherId: "teacher-101",
    grantType: "class",
    targetId: 22
  });

  await service.logPasswordReset({
    operator: "admin-2",
    studentId: 2002
  });

  await service.logActivityPublish({
    operator: "admin-3",
    activityType: "course",
    activityTitle: "就业指导课"
  });

  assert.equal(fixture.logs.length, 4);

  for (const log of fixture.logs) {
    assert.ok(log.operator.length > 0);
    assert.ok(log.target.length > 0);
    assert.ok(log.action.length > 0);
    assert.ok(log.createdAt instanceof Date);
  }

  assert.equal(fixture.logs[0].action, "authorization_grant");
  assert.equal(fixture.logs[1].action, "authorization_revoke");
  assert.equal(fixture.logs[2].action, "password_reset");
  assert.equal(fixture.logs[3].action, "activity_publish");
});
