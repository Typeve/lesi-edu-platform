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
      excelImportValidationService: {
        async validateExcelImport() {
          return { total: 0, success: 0, failed: 0, errors: [] };
        }
      },
      dashboardDimensionAggregationService: {
        async aggregateByDimension(input) {
          return {
            dictionaryVersion: "b07.v1",
            dimension: input.dimension,
            metricCards: {
              activatedStudentsCount: 100,
              assessmentCompletionRate: 0.8,
              reportGenerationRate: 0.7,
              taskCompletionRate: 0.6,
              activityParticipationRate: 0.5
            },
            barChart: {
              dimension: input.dimension,
              categories: ["计算机学院"],
              series: []
            },
            stackedBarChart: {
              dimension: input.dimension,
              categories: ["计算机学院"],
              series: []
            }
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

test("admin cockpit should return full-school overview metrics and dimension views", async () => {
  const app = createApp();

  const response = await app.request(
    "/admin/dashboard/cockpit?dimension=major&collegeId=1&startDate=2026-02-01&endDate=2026-03-02",
    {
      headers: {
        "X-Admin-Key": adminApiKey
      }
    }
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    overview: { activatedStudentsCount: number; assessmentCompletionRate: number; reportGenerationRate: number; taskCompletionRate: number; activityParticipationRate: number };
    byDimension: { dimension: string };
  };

  assert.equal(body.overview.activatedStudentsCount, 100);
  assert.equal(body.overview.assessmentCompletionRate, 0.8);
  assert.equal(body.overview.reportGenerationRate, 0.7);
  assert.equal(body.overview.taskCompletionRate, 0.6);
  assert.equal(body.overview.activityParticipationRate, 0.5);
  assert.equal(body.byDimension.dimension, "major");
});

test("admin cockpit should return 400 for invalid filter", async () => {
  const app = createApp();

  const response = await app.request("/admin/dashboard/cockpit?collegeId=abc", {
    headers: {
      "X-Admin-Key": adminApiKey
    }
  });

  assert.equal(response.status, 400);
});
