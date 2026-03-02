import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createReportJobSyncService,
  type ReportJobSyncRepository
} from "../../src/modules/report/job-sync.ts";

const authorizedStudentMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header("authorization") ?? "";
  if (authorization !== "Bearer valid-token") {
    return c.json({ message: "unauthorized" }, 401);
  }

  c.set("studentAuth", {
    studentId: 1001,
    studentNo: "S20261001",
    mustChangePassword: false
  });

  await next();
};

test("report job sync service should persist job payload with required fields", async () => {
  const jobs: Array<{ studentNo: string; payloadJson: string; status: string }> = [];

  const repo: ReportJobSyncRepository = {
    async createJob(input) {
      jobs.push({
        studentNo: input.studentNo,
        payloadJson: input.payloadJson,
        status: input.status
      });
      return 1;
    }
  };

  const service = createReportJobSyncService({ reportJobRepo: repo });

  const result = await service.syncGeneratedReports({
    studentNo: "S20261001",
    reports: [
      { direction: "employment", markdown: "# 就业" },
      { direction: "postgraduate", markdown: "# 考研" },
      { direction: "civil_service", markdown: "# 考公" }
    ]
  });

  assert.equal(result.jobId, 1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].studentNo, "S20261001");
  assert.equal(jobs[0].status, "done");
});

test("POST /student/reports/generate should return jobId after sync", async () => {
  const app = new Hono();
  app.route(
    "/student",
    createStudentRoutes({
      requireStudentAuth: authorizedStudentMiddleware,
      certificateUploadService: {
        async uploadCertificate() {
          throw new Error("not implemented");
        }
      },
      likertAssessmentService: {
        async getQuestions() {
          return { version: "v1" as const, scaleMin: 1 as const, scaleMax: 5 as const, questions: [] };
        },
        async submitAnswers() {
          return { submissionId: 1, overwritten: false, answerCount: 50, submittedAt: new Date().toISOString() };
        }
      },
      likertAssessmentResultService: {
        async getResult() {
          return {
            dimensionScores: { interest: 80, ability: 82, value: 84 },
            weights: { interest: 0.4 as const, ability: 0.4 as const, value: 0.2 as const },
            scores: [
              { direction: "employment" as const, score: 82 },
              { direction: "postgraduate" as const, score: 81 },
              { direction: "civil_service" as const, score: 80 }
            ],
            recommendation: { direction: "employment" as const, reason: "test" }
          };
        }
      },
      roleModelMatchingService: {
        async matchRoleModels() {
          return { strategy: "score_gap_fallback" as const, matched: [] };
        }
      },
      reportGenerationService: {
        async generateAllReports() {
          return {
            reports: [
              { direction: "employment" as const, markdown: "# 就业报告" },
              { direction: "postgraduate" as const, markdown: "# 考研报告" },
              { direction: "civil_service" as const, markdown: "# 考公报告" }
            ]
          };
        }
      },
      reportJobSyncService: {
        async syncGeneratedReports() {
          return { jobId: 99, status: "done" as const };
        }
      }
    })
  );

  const response = await app.request("/student/reports/generate", {
    method: "POST",
    headers: { authorization: "Bearer valid-token" }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.jobId, 99);
  assert.equal(payload.reports.length, 3);
});
