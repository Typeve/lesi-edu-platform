import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";
import { createTeacherRoutes } from "../../src/routes/teacher.ts";
import { TeacherActivityForbiddenError } from "../../src/modules/teacher/activity-execution.ts";

interface ActivityFlowStore {
  nextActivityId: number;
  activityOwner: Map<number, string>;
  executionRecords: Array<{ activityId: number; teacherId: string }>;
}

const adminApiKey = "admin-secret-key";

const buildApp = (store: ActivityFlowStore) => {
  const app = new Hono();

  app.route(
    "/admin",
    createAdminRoutes({
      studentAuthService: {
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      authorizationGrantService: {
        async assignGrant() {
          return;
        },
        async revokeGrant() {
          return;
        }
      },
      activityService: {
        async publishActivity(input) {
          const activityId = store.nextActivityId++;
          store.activityOwner.set(activityId, input.ownerTeacherId);
          return { activityId };
        },
        async listActivities() {
          return [];
        }
      },
      auditLogService: {
        async logAuthorizationGrant() {
          return;
        },
        async logAuthorizationRevoke() {
          return;
        },
        async logPasswordReset() {
          return;
        },
        async logActivityPublish() {
          return;
        }
      },
      adminApiKey
    })
  );

  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: {
        async getMyStudents() {
          return { page: 1, pageSize: 20, total: 0, items: [] };
        }
      },
      teacherStudentDetailService: {
        async getStudentDetail() {
          return null as never;
        }
      },
      teacherActivityExecutionService: {
        async executeActivity(input) {
          const owner = store.activityOwner.get(input.activityId);
          if (!owner || owner !== input.teacherId) {
            throw new TeacherActivityForbiddenError();
          }
          store.executionRecords.push({ activityId: input.activityId, teacherId: input.teacherId });
          return { recordId: store.executionRecords.length, status: "submitted" as const };
        }
      }
    })
  );

  return app;
};

test("activity publish-execute integration should support owner execution and reject unauthorized role", async () => {
  const store: ActivityFlowStore = {
    nextActivityId: 1,
    activityOwner: new Map<number, string>(),
    executionRecords: []
  };
  const app = buildApp(store);

  const publishRes = await app.request("/admin/activities", {
    method: "POST",
    headers: {
      "x-admin-key": adminApiKey,
      "x-admin-operator-id": "admin-001",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      activityType: "course",
      title: "就业指导课",
      scopeType: "class",
      scopeTargetId: 11,
      ownerTeacherId: "T-1",
      startAt: "2026-03-01T08:00:00.000Z",
      endAt: "2026-03-10T08:00:00.000Z",
      timelineNodes: [{ key: "execute", at: "2026-03-08T08:00:00.000Z" }]
    })
  });
  assert.equal(publishRes.status, 201);

  const ownerExecute = await app.request("/teacher/activities/1/execute", {
    method: "POST",
    headers: {
      "x-teacher-id": "T-1",
      "content-type": "application/json"
    },
    body: JSON.stringify({ result: { score: 95 } })
  });
  assert.equal(ownerExecute.status, 200);

  const unauthorizedExecute = await app.request("/teacher/activities/1/execute", {
    method: "POST",
    headers: {
      "x-teacher-id": "T-2",
      "content-type": "application/json"
    },
    body: JSON.stringify({ result: { score: 90 } })
  });
  assert.equal(unauthorizedExecute.status, 403);

  const missingRoleExecute = await app.request("/teacher/activities/1/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ result: { score: 90 } })
  });
  assert.equal(missingRoleExecute.status, 401);

  assert.equal(store.executionRecords.length, 1);
  assert.equal(store.executionRecords[0].activityId, 1);
});
