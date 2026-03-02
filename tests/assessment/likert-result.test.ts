import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createLikertAssessmentResultService,
  LikertAssessmentResultNotFoundError,
  type LikertAssessmentResultRepository
} from "../../src/modules/assessment/result.ts";

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

const makeAnswers = (score = 4) =>
  Array.from({ length: 50 }, (_, index) => ({
    questionId: index + 1,
    score
  }));

test("assessment result service should calculate three directions with 0.4/0.4/0.2", async () => {
  const repo: LikertAssessmentResultRepository = {
    async findSubmissionByStudentId() {
      return {
        id: 1,
        studentId: 1001,
        answersJson: JSON.stringify(makeAnswers(5))
      };
    }
  };

  const service = createLikertAssessmentResultService({ resultRepo: repo });
  const result = await service.getResult({ studentId: 1001 });

  assert.equal(result.weights.interest, 0.4);
  assert.equal(result.weights.ability, 0.4);
  assert.equal(result.weights.value, 0.2);
  assert.equal(result.scores.length, 3);
  assert.ok(result.scores.every((item) => item.score >= 0 && item.score <= 100));
  assert.ok(result.recommendation.direction);
  assert.ok(result.recommendation.reason.length > 0);
});

test("assessment result service should throw not found when submission missing", async () => {
  const repo: LikertAssessmentResultRepository = {
    async findSubmissionByStudentId() {
      return null;
    }
  };

  const service = createLikertAssessmentResultService({ resultRepo: repo });

  await assert.rejects(
    async () => {
      await service.getResult({ studentId: 1001 });
    },
    (error: unknown) => error instanceof LikertAssessmentResultNotFoundError
  );
});

test("GET /student/assessments/result should return result after login", async () => {
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
            dimensionScores: { interest: 88, ability: 90, value: 85 },
            weights: { interest: 0.4 as const, ability: 0.4 as const, value: 0.2 as const },
            scores: [
              { direction: "employment" as const, score: 88.2 },
              { direction: "postgraduate" as const, score: 87.6 },
              { direction: "civil_service" as const, score: 88.6 }
            ],
            recommendation: {
              direction: "civil_service" as const,
              reason: "你的价值稳定性与执行力较高，建议优先考虑考公方向。"
            }
          };
        }
      }
    })
  );

  const response = await app.request("/student/assessments/result", {
    headers: {
      authorization: "Bearer valid-token"
    }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.scores.length, 3);
  assert.equal(payload.recommendation.direction, "civil_service");
});
