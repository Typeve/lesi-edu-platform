import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";
import { createTeacherRoutes } from "../../src/routes/teacher.ts";

interface AuthFlowStore {
  classGrants: Set<number>;
  auditActions: string[];
}

const adminApiKey = "admin-secret-key";

const buildApp = (store: AuthFlowStore) => {
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
        async assignGrant(input) {
          if (input.grantType === "class") {
            store.classGrants.add(input.targetId);
          }
          return;
        },
        async revokeGrant(input) {
          if (input.grantType === "class") {
            store.classGrants.delete(input.targetId);
          }
          return;
        }
      },
      activityService: {
        async publishActivity() {
          return { activityId: 1 };
        },
        async listActivities() {
          return [];
        }
      },
      auditLogService: {
        async logAuthorizationGrant() {
          store.auditActions.push("authorization_grant");
        },
        async logAuthorizationRevoke() {
          store.auditActions.push("authorization_revoke");
        },
        async logPasswordReset() {
          store.auditActions.push("password_reset");
        },
        async logActivityPublish() {
          store.auditActions.push("activity_publish");
        }
      },
      adminApiKey
    })
  );

  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: {
        async getMyStudents(query) {
          const visibleClass = 11;
          const items = store.classGrants.has(visibleClass)
            ? [
                {
                  studentId: 1001,
                  studentNo: "S20261001",
                  name: "张三",
                  classId: visibleClass,
                  className: "11班",
                  majorId: 1,
                  majorName: "计算机",
                  grade: 2026,
                  assessmentDone: true,
                  reportGenerated: true
                }
              ]
            : [];

          return {
            page: query.page,
            pageSize: query.pageSize,
            total: items.length,
            items
          };
        }
      },
      teacherStudentDetailService: {
        async getStudentDetail() {
          return null as never;
        }
      },
      teacherActivityExecutionService: {
        async executeActivity() {
          return { recordId: 1, status: "submitted" as const };
        }
      }
    })
  );

  return app;
};

test("authorization flow integration should grant then revoke teacher visibility with audit logs", async () => {
  const store: AuthFlowStore = {
    classGrants: new Set<number>(),
    auditActions: []
  };
  const app = buildApp(store);

  const before = await app.request("/teacher/my-students", {
    headers: { "x-teacher-id": "T-1" }
  });
  assert.equal(before.status, 200);
  assert.equal((await before.json()).total, 0);

  const grantResp = await app.request("/admin/authorizations/grants", {
    method: "POST",
    headers: {
      "x-admin-key": adminApiKey,
      "x-admin-operator-id": "admin-001",
      "content-type": "application/json"
    },
    body: JSON.stringify({ grantType: "class", teacherId: "T-1", targetId: 11 })
  });
  assert.equal(grantResp.status, 200);

  const afterGrant = await app.request("/teacher/my-students", {
    headers: { "x-teacher-id": "T-1" }
  });
  assert.equal(afterGrant.status, 200);
  assert.equal((await afterGrant.json()).total, 1);

  const revokeResp = await app.request("/admin/authorizations/grants", {
    method: "DELETE",
    headers: {
      "x-admin-key": adminApiKey,
      "x-admin-operator-id": "admin-001",
      "content-type": "application/json"
    },
    body: JSON.stringify({ grantType: "class", teacherId: "T-1", targetId: 11 })
  });
  assert.equal(revokeResp.status, 200);

  const afterRevoke = await app.request("/teacher/my-students", {
    headers: { "x-teacher-id": "T-1" }
  });
  assert.equal(afterRevoke.status, 200);
  assert.equal((await afterRevoke.json()).total, 0);

  assert.deepEqual(store.auditActions, ["authorization_grant", "authorization_revoke"]);
});
