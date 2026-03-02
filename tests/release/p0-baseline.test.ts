import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";

const adminApiKey = "admin-secret-key";

const createApp = () => {
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
        async publishActivity() {
          return { activityId: 1 };
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

  return app;
};

test("admin p0 baseline endpoint should return checklist, error-rate threshold and traceability fields", async () => {
  const app = createApp();
  const response = await app.request("/admin/release/p0-baseline", {
    headers: {
      "x-admin-key": adminApiKey
    }
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    checklist: Array<{ passed: boolean }>;
    apiQuality: { targetErrorRate: number; observedErrorRate: number };
    traceability: { import: { status: string }; report: { status: string }; task: { status: string } };
  };

  assert.equal(body.checklist.every((item) => item.passed), true);
  assert.equal(body.apiQuality.targetErrorRate, 0.01);
  assert.ok(body.apiQuality.observedErrorRate < 0.01);
  assert.equal(body.traceability.import.status, "traceable");
  assert.equal(body.traceability.report.status, "traceable");
  assert.equal(body.traceability.task.status, "traceable");
});
