import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";

const adminApiKey = "admin-secret-key";

interface CallSnapshot {
  dimension: string;
  schoolId?: number;
  collegeId?: number;
  majorId?: number;
  classId?: number;
}

const createApp = (calls: CallSnapshot[] = []) => {
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
          return;
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
          calls.push({
            dimension: input.dimension,
            schoolId: input.filters.schoolId,
            collegeId: input.filters.collegeId,
            majorId: input.filters.majorId,
            classId: input.filters.classId
          });
          return {
            dictionaryVersion: "b07.v1",
            dimension: input.dimension,
            metricCards: {
              activatedStudentsCount: 100,
              assessmentCompletionRate: 0.8,
              reportGenerationRate: 0.7,
              taskCompletionRate: 0.5,
              activityParticipationRate: 0.3
            },
            barChart: {
              dimension: input.dimension,
              categories: ["信息工程学院"],
              series: []
            },
            stackedBarChart: {
              dimension: input.dimension,
              categories: ["信息工程学院"],
              series: []
            }
          };
        }
      },
      adminApiKey
    })
  );

  return app;
};

test("admin dashboard aggregation should return 403 without admin key", async () => {
  const app = createApp();

  const response = await app.request("/admin/dashboard/dimension-aggregation?dimension=college");

  assert.equal(response.status, 403);
});

test("admin dashboard aggregation should return 400 for invalid dimension", async () => {
  const app = createApp();

  const response = await app.request("/admin/dashboard/dimension-aggregation?dimension=invalid", {
    headers: {
      "X-Admin-Key": adminApiKey
    }
  });

  assert.equal(response.status, 400);
});

test("admin dashboard aggregation should return aggregated payload", async () => {
  const calls: CallSnapshot[] = [];
  const app = createApp(calls);

  const response = await app.request(
    "/admin/dashboard/dimension-aggregation?dimension=college&schoolId=1&collegeId=10",
    {
      headers: {
        "X-Admin-Key": adminApiKey
      }
    }
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    dictionaryVersion: string;
    metricCards: { activatedStudentsCount: number };
  };

  assert.equal(body.dictionaryVersion, "b07.v1");
  assert.equal(body.metricCards.activatedStudentsCount, 100);
  assert.deepEqual(calls, [
    {
      dimension: "college",
      schoolId: 1,
      collegeId: 10,
      majorId: undefined,
      classId: undefined
    }
  ]);
});

test("admin dashboard aggregation should return 400 for invalid filter format", async () => {
  const app = createApp();

  const response = await app.request(
    "/admin/dashboard/dimension-aggregation?dimension=major&schoolId=abc",
    {
      headers: {
        "X-Admin-Key": adminApiKey
      }
    }
  );

  assert.equal(response.status, 400);
});
