import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorizationGrantService } from "../../src/modules/authorization/grant-service.ts";

test("authorization grant service should default accessLevel to read", async () => {
  const calls: Array<{ grantType: "student" | "class"; accessLevel: "read" | "manage" }> = [];
  const service = createAuthorizationGrantService({
    authorizationGrantRepo: {
      async assignStudentGrant(_teacherId, _studentId, accessLevel) {
        calls.push({ grantType: "student", accessLevel });
      },
      async revokeStudentGrant() {},
      async assignClassGrant(_teacherId, _classId, accessLevel) {
        calls.push({ grantType: "class", accessLevel });
      },
      async revokeClassGrant() {}
    }
  });

  await service.assignGrant({ grantType: "student", teacherId: "T-1", targetId: 1 });
  await service.assignGrant({
    grantType: "class",
    teacherId: "T-1",
    targetId: 2,
    accessLevel: "manage"
  });

  assert.deepEqual(calls, [
    { grantType: "student", accessLevel: "read" },
    { grantType: "class", accessLevel: "manage" }
  ]);
});
