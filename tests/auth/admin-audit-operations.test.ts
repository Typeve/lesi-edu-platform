import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";
import type { PublishActivityInput } from "../../src/modules/activity/service.ts";
import type { AuthorizationGrantInput } from "../../src/modules/authorization/grant-service.ts";

interface OperationFixture {
  assigned: Array<{ grantType: "student" | "class"; teacherId: string; targetId: number; accessLevel?: "read" | "manage" }>;
  revoked: Array<{ grantType: "student" | "class"; teacherId: string; targetId: number }>;
  published: Array<{
    activityType: "course" | "competition" | "project";
    title: string;
    scopeType: "school" | "college" | "class";
    scopeTargetId: number;
    ownerTeacherId: string;
    startAt: Date;
    endAt: Date;
    timelineNodes: Array<{ key: string; at: string }>;
    status?: "draft" | "published" | "closed";
  }>;
  auditActions: string[];
}

const adminApiKey = "admin-secret-key";

const buildApp = (fixture: OperationFixture) => {
  const app = new Hono();

  app.route(
    "/admin",
    createAdminRoutes({
      studentAuthService: {
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      adminApiKey,
      authorizationGrantService: {
        async assignGrant(input: AuthorizationGrantInput) {
          fixture.assigned.push(input);
        },
        async revokeGrant(input: AuthorizationGrantInput) {
          fixture.revoked.push(input);
        }
      },
      activityService: {
        async publishActivity(input: PublishActivityInput) {
          fixture.published.push(input);
          return { activityId: 1 };
        },
        async listActivities() {
          return [];
        }
      },
      auditLogService: {
        async logAuthorizationGrant() {
          fixture.auditActions.push("authorization_grant");
        },
        async logAuthorizationRevoke() {
          fixture.auditActions.push("authorization_revoke");
        },
        async logPasswordReset() {
          fixture.auditActions.push("password_reset");
        },
        async logActivityPublish() {
          fixture.auditActions.push("activity_publish");
        }
      }
    })
  );

  return app;
};

test("admin authorization grant/revoke endpoints should write audit logs", async () => {
  const fixture: OperationFixture = {
    assigned: [],
    revoked: [],
    published: [],
    auditActions: []
  };
  const app = buildApp(fixture);

  const grantRes = await app.request("/admin/authorizations/grants", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey,
      "X-Admin-Operator-Id": "admin-001"
    },
    body: JSON.stringify({
      grantType: "student",
      teacherId: "teacher-1",
      targetId: 1001
    })
  });

  assert.equal(grantRes.status, 200);

  const revokeRes = await app.request("/admin/authorizations/grants", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey,
      "X-Admin-Operator-Id": "admin-001"
    },
    body: JSON.stringify({
      grantType: "student",
      teacherId: "teacher-1",
      targetId: 1001
    })
  });

  assert.equal(revokeRes.status, 200);
  assert.equal(fixture.assigned.length, 1);
  assert.equal(fixture.revoked.length, 1);
  assert.deepEqual(fixture.auditActions, ["authorization_grant", "authorization_revoke"]);
});

test("admin activity publish endpoint should write audit log", async () => {
  const fixture: OperationFixture = {
    assigned: [],
    revoked: [],
    published: [],
    auditActions: []
  };
  const app = buildApp(fixture);

  const publishRes = await app.request("/admin/activities", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey,
      "X-Admin-Operator-Id": "admin-002"
    },
    body: JSON.stringify({
      activityType: "course",
      title: "就业指导课",
      scopeType: "class",
      scopeTargetId: 11,
      ownerTeacherId: "teacher-1",
      startAt: "2026-03-02T08:00:00.000Z",
      endAt: "2026-03-10T08:00:00.000Z",
      timelineNodes: [
        { key: "signup", at: "2026-03-03T08:00:00.000Z" },
        { key: "execute", at: "2026-03-08T08:00:00.000Z" }
      ]
    })
  });

  assert.equal(publishRes.status, 201);
  assert.equal(fixture.published.length, 1);
  assert.deepEqual(fixture.auditActions, ["activity_publish"]);
});

test("admin authorization batch grant/revoke should support multiple items and accessLevel", async () => {
  const fixture: OperationFixture = {
    assigned: [],
    revoked: [],
    published: [],
    auditActions: []
  };
  const app = buildApp(fixture);

  const grantRes = await app.request("/admin/authorizations/grants/batch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey,
      "X-Admin-Operator-Id": "admin-001"
    },
    body: JSON.stringify({
      grants: [
        { grantType: "class", teacherId: "teacher-1", targetId: 11, accessLevel: "manage" },
        { grantType: "student", teacherId: "teacher-1", targetId: 1001, accessLevel: "read" }
      ]
    })
  });

  assert.equal(grantRes.status, 200);
  assert.equal(fixture.assigned.length, 2);
  assert.equal(fixture.assigned[0].accessLevel, "manage");
  assert.equal(fixture.assigned[1].accessLevel, "read");

  const revokeRes = await app.request("/admin/authorizations/grants/batch", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey,
      "X-Admin-Operator-Id": "admin-001"
    },
    body: JSON.stringify({
      grants: [
        { grantType: "class", teacherId: "teacher-1", targetId: 11 },
        { grantType: "student", teacherId: "teacher-1", targetId: 1001 }
      ]
    })
  });

  assert.equal(revokeRes.status, 200);
  assert.equal(fixture.revoked.length, 2);
  assert.deepEqual(fixture.auditActions, [
    "authorization_grant",
    "authorization_grant",
    "authorization_revoke",
    "authorization_revoke"
  ]);
});

test("admin activity publish should return 400 when payload missing scope/owner/time", async () => {
  const fixture: OperationFixture = {
    assigned: [],
    revoked: [],
    published: [],
    auditActions: []
  };
  const app = buildApp(fixture);

  const publishRes = await app.request("/admin/activities", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey,
      "X-Admin-Operator-Id": "admin-002"
    },
    body: JSON.stringify({
      activityType: "course",
      title: "就业指导课"
    })
  });

  assert.equal(publishRes.status, 400);
});

test("admin should list activity statuses", async () => {
  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      studentAuthService: {
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      adminApiKey,
      authorizationGrantService: {
        async assignGrant() {},
        async revokeGrant() {}
      },
      activityService: {
        async publishActivity() {
          return { activityId: 1 };
        },
        async listActivities() {
          return [
            {
              activityId: 1,
              activityType: "course" as const,
              title: "就业指导课",
              scopeType: "class" as const,
              scopeTargetId: 11,
              ownerTeacherId: "teacher-1",
              startAt: new Date("2026-03-02T08:00:00.000Z"),
              endAt: new Date("2026-03-10T08:00:00.000Z"),
              status: "published" as const,
              timelineNodes: [{ key: "execute", at: "2026-03-08T08:00:00.000Z" }]
            }
          ];
        }
      },
      auditLogService: {
        async logAuthorizationGrant() {},
        async logAuthorizationRevoke() {},
        async logPasswordReset() {},
        async logActivityPublish() {}
      }
    })
  );

  const response = await app.request("/admin/activities", {
    method: "GET",
    headers: { "X-Admin-Key": adminApiKey }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].status, "published");
});
