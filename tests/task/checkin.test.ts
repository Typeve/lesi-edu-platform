import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createTaskCheckInService,
  TaskCheckInTaskNotFoundError,
  type TaskCheckInRepository
} from "../../src/modules/task/checkin.ts";

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

test("task check-in service should upsert checkin with certificate file", async () => {
  let saved = 0;

  const repo: TaskCheckInRepository = {
    async findTaskByIdAndStudentId() {
      return { id: 10, studentId: 1001 };
    },
    async hasCertificateFileForStudent() {
      return true;
    },
    async upsertTaskCheckIn() {
      saved += 1;
      return 1;
    }
  };

  const service = createTaskCheckInService({ taskCheckInRepo: repo });
  const result = await service.submitTaskCheckIn({
    taskId: 10,
    studentId: 1001,
    fileId: "cert_xxx",
    note: "完成任务"
  });

  assert.equal(result.checkInId, 1);
  assert.equal(saved, 1);
});

test("task check-in service should throw when task not found", async () => {
  const repo: TaskCheckInRepository = {
    async findTaskByIdAndStudentId() {
      return null;
    },
    async hasCertificateFileForStudent() {
      return true;
    },
    async upsertTaskCheckIn() {
      return 1;
    }
  };

  const service = createTaskCheckInService({ taskCheckInRepo: repo });

  await assert.rejects(
    async () => {
      await service.submitTaskCheckIn({ taskId: 999, studentId: 1001, fileId: null, note: null });
    },
    (error: unknown) => error instanceof TaskCheckInTaskNotFoundError
  );
});

test("POST /student/tasks/:taskId/check-ins should return checkInId", async () => {
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
          return { reports: [] };
        }
      },
      reportJobSyncService: {
        async syncGeneratedReports() {
          return { jobId: 1, status: "done" as const };
        }
      },
      taskCheckInService: {
        async submitTaskCheckIn() {
          return { checkInId: 77, status: "submitted" as const };
        }
      }
    })
  );

  const response = await app.request("/student/tasks/10/check-ins", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fileId: "cert_xxx",
      note: "完成任务"
    })
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.checkInId, 77);
});
