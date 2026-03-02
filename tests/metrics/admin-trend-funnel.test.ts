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
      excelImportValidationService: {
        async validateExcelImport() {
          return { total: 0, success: 0, failed: 0, errors: [] };
        }
      },
      dashboardDimensionAggregationService: {
        async aggregateByDimension() {
          return {
            dictionaryVersion: "b07.v1",
            dimension: "college" as const,
            metricCards: {
              activatedStudentsCount: 0,
              assessmentCompletionRate: 0,
              reportGenerationRate: 0,
              taskCompletionRate: 0,
              activityParticipationRate: 0
            },
            barChart: { dimension: "college" as const, categories: [], series: [] },
            stackedBarChart: { dimension: "college" as const, categories: [], series: [] }
          };
        }
      },
      dashboardTrendFunnelService: {
        async getTrendAndFunnel() {
          return {
            dictionaryVersion: "b07.v1",
            dateRange: {
              startDate: "2026-02-01",
              endDate: "2026-03-02"
            },
            trend: [],
            funnel: []
          };
        }
      },
      adminApiKey
    })
  );

  return app;
};

test("admin trend-funnel should return 403 without admin key", async () => {
  const app = createApp();
  const response = await app.request("/admin/dashboard/trend-funnel");
  assert.equal(response.status, 403);
});

test("admin trend-funnel should return 400 when date range is invalid", async () => {
  const app = createApp();
  const response = await app.request(
    "/admin/dashboard/trend-funnel?startDate=2026-03-10&endDate=2026-03-02",
    { headers: { "X-Admin-Key": adminApiKey } }
  );
  assert.equal(response.status, 400);
});

test("admin trend-funnel should return trend and funnel payload", async () => {
  const app = createApp();
  const response = await app.request(
    "/admin/dashboard/trend-funnel?schoolId=1&collegeId=2&startDate=2026-02-01&endDate=2026-03-02",
    { headers: { "X-Admin-Key": adminApiKey } }
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { dictionaryVersion: string };
  assert.equal(body.dictionaryVersion, "b07.v1");
});
