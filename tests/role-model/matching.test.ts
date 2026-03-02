import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createRoleModelMatchingService,
  type RoleModelMatchingRepository
} from "../../src/modules/role-model/matching.ts";

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

test("role model matching should prioritize same school and major", async () => {
  const repo: RoleModelMatchingRepository = {
    async findStudentEnrollmentProfile() {
      return {
        studentNo: "S20261001",
        schoolName: "华南理工大学",
        majorName: "软件工程",
        score: 620
      };
    },
    async listRoleModelCandidates() {
      return [
        { studentNo: "A", name: "A", schoolName: "其他学校", majorName: "软件工程", score: 620, direction: "employment" as const },
        { studentNo: "B", name: "B", schoolName: "华南理工大学", majorName: "软件工程", score: 630, direction: "employment" as const }
      ];
    }
  };

  const service = createRoleModelMatchingService({ roleModelRepo: repo });
  const result = await service.matchRoleModels({
    studentNo: "S20261001",
    direction: "employment"
  });

  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].studentNo, "B");
  assert.equal(result.strategy, "same_school_same_major");
});

test("role model matching should fallback to score gap when no same school major", async () => {
  const repo: RoleModelMatchingRepository = {
    async findStudentEnrollmentProfile() {
      return {
        studentNo: "S20261001",
        schoolName: "华南理工大学",
        majorName: "软件工程",
        score: 620
      };
    },
    async listRoleModelCandidates() {
      return [
        { studentNo: "A", name: "A", schoolName: "其他学校", majorName: "金融学", score: 619, direction: "employment" as const },
        { studentNo: "B", name: "B", schoolName: "其他学校", majorName: "法学", score: 650, direction: "employment" as const }
      ];
    }
  };

  const service = createRoleModelMatchingService({ roleModelRepo: repo });
  const result = await service.matchRoleModels({
    studentNo: "S20261001",
    direction: "employment"
  });

  assert.equal(result.strategy, "score_gap_fallback");
  assert.equal(result.matched[0].studentNo, "A");
});

test("GET /student/role-models/match should return matched role models", async () => {
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
          return {
            strategy: "same_school_same_major" as const,
            matched: [
              {
                studentNo: "S20250001",
                name: "李同学",
                schoolName: "华南理工大学",
                majorName: "软件工程",
                score: 618,
                scoreGap: 2,
                direction: "employment" as const
              }
            ]
          };
        }
      }
    })
  );

  const response = await app.request("/student/role-models/match?direction=employment", {
    headers: {
      authorization: "Bearer valid-token"
    }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.strategy, "same_school_same_major");
  assert.equal(payload.matched.length, 1);
});
