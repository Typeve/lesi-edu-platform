import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createReportGenerationService,
  type ReportGenerationInput
} from "../../src/modules/report/generation.ts";

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

const baseInput: ReportGenerationInput = {
  studentNo: "S20261001",
  dimensionScores: {
    interest: 84,
    ability: 86,
    value: 82
  },
  recommendation: {
    direction: "employment",
    reason: "建议优先就业实践"
  }
};

test("report generation service should output three markdown reports", async () => {
  const service = createReportGenerationService();
  const result = await service.generateAllReports(baseInput);

  assert.equal(result.reports.length, 3);
  assert.ok(result.reports[0].markdown.includes("#"));
  assert.ok(result.reports.some((item) => item.direction === "employment"));
  assert.ok(result.reports.some((item) => item.direction === "postgraduate"));
  assert.ok(result.reports.some((item) => item.direction === "civil_service"));
});

test("POST /student/reports/generate should return three reports", async () => {
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
      }
    })
  );

  const response = await app.request("/student/reports/generate", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token"
    }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.reports.length, 3);
});
