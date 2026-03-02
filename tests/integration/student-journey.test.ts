import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import { createStudentRoutes } from "../../src/routes/student.ts";
import { TaskCheckInTaskNotFoundError } from "../../src/modules/task/checkin.ts";

interface JourneyStore {
  enrollmentProfileQueried: boolean;
  assessmentSubmission: { studentId: number; answerCount: number } | null;
  reportJobId: number | null;
  taskCheckInId: number | null;
}

const buildApp = (store: JourneyStore) => {
  const app = new Hono();

  const requireStudentAuth: MiddlewareHandler = async (c, next) => {
    c.set("studentAuth", {
      studentId: 1001,
      studentNo: "S20261001"
    });
    await next();
  };

  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          return {
            token: "test-token",
            tokenType: "Bearer",
            expiresIn: 3600,
            mustChangePassword: false
          };
        },
        async changeStudentPassword() {
          return;
        },
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      studentFirstLoginVerificationService: {
        async verifyStudentFirstLogin() {
          return {
            verified: true,
            verifiedAt: "2026-03-02T10:00:00.000Z"
          };
        }
      },
      enrollmentProfileService: {
        async getEnrollmentProfile() {
          store.enrollmentProfileQueried = true;
          return {
            status: "complete" as const,
            profile: {
              studentNo: "S20261001",
              name: "张三",
              schoolName: "示例大学",
              majorName: "计算机科学与技术",
              score: 620,
              admissionYear: 2026
            }
          };
        }
      },
      requireStudentAuth
    })
  );

  app.route(
    "/student",
    createStudentRoutes({
      requireStudentAuth,
      certificateUploadService: {
        async uploadCertificate() {
          return { fileId: "file-1" };
        }
      },
      likertAssessmentService: {
        async getQuestions() {
          return {
            questionSetVersion: "v1",
            totalQuestions: 50,
            questions: Array.from({ length: 50 }, (_, idx) => ({
              questionId: idx + 1,
              dimension: "self_cognition",
              text: `Q${idx + 1}`,
              order: idx + 1
            }))
          };
        },
        async submitAnswers(input) {
          store.assessmentSubmission = {
            studentId: input.studentId,
            answerCount: input.answers.length
          };
          return {
            submissionId: 1,
            questionSetVersion: "v1",
            answerCount: input.answers.length,
            submittedAt: "2026-03-02T10:10:00.000Z"
          };
        }
      },
      likertAssessmentResultService: {
        async getResult() {
          return {
            studentId: 1001,
            questionSetVersion: "v1",
            dimensionScores: {
              selfCognition: 80,
              careerPlanning: 78,
              executionPower: 75
            },
            recommendation: {
              direction: "employment" as const,
              summary: "建议优先就业方向"
            },
            generatedAt: "2026-03-02T10:11:00.000Z"
          };
        }
      },
      roleModelMatchingService: {
        async matchRoleModels() {
          return {
            direction: "employment" as const,
            models: [
              { studentNo: "R1", name: "榜样A", scoreGap: 5, tags: ["同专业"] }
            ]
          };
        }
      },
      reportGenerationService: {
        async generateAllReports() {
          return {
            reports: {
              employment: "# 就业报告",
              postgraduate: "# 升学报告",
              civilService: "# 公考报告"
            }
          };
        }
      },
      reportJobSyncService: {
        async syncGeneratedReports() {
          store.reportJobId = 99;
          return {
            jobId: 99,
            status: "done"
          };
        }
      },
      taskCheckInService: {
        async submitTaskCheckIn(input) {
          if (input.taskId !== 1) {
            throw new TaskCheckInTaskNotFoundError();
          }
          store.taskCheckInId = 11;
          return {
            checkInId: 11,
            status: "submitted" as const
          };
        }
      }
    })
  );

  return app;
};

test("student journey integration should complete full chain and produce queryable data", async () => {
  const store: JourneyStore = {
    enrollmentProfileQueried: false,
    assessmentSubmission: null,
    reportJobId: null,
    taskCheckInId: null
  };
  const app = buildApp(store);

  const loginRes = await app.request("/auth/student/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentNo: "S20261001", password: "Passw0rd!" })
  });
  assert.equal(loginRes.status, 200);

  const profileRes = await app.request("/auth/student/enrollment-profile");
  assert.equal(profileRes.status, 200);

  const questionsRes = await app.request("/student/assessments/questions");
  assert.equal(questionsRes.status, 200);

  const answers = Array.from({ length: 50 }, (_, idx) => ({ questionId: idx + 1, score: 4 }));
  const submitRes = await app.request("/student/assessments/submissions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers })
  });
  assert.equal(submitRes.status, 200);

  const resultRes = await app.request("/student/assessments/result");
  assert.equal(resultRes.status, 200);

  const roleModelRes = await app.request("/student/role-models/match?direction=employment");
  assert.equal(roleModelRes.status, 200);

  const reportRes = await app.request("/student/reports/generate", { method: "POST" });
  assert.equal(reportRes.status, 200);

  const checkInRes = await app.request("/student/tasks/1/check-ins", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileId: "file-1", note: "已完成" })
  });
  assert.equal(checkInRes.status, 200);

  assert.equal(store.enrollmentProfileQueried, true);
  assert.equal(store.assessmentSubmission?.answerCount, 50);
  assert.equal(store.reportJobId, 99);
  assert.equal(store.taskCheckInId, 11);
});

test("student journey should expose locatable failure point for missing task", async () => {
  const store: JourneyStore = {
    enrollmentProfileQueried: false,
    assessmentSubmission: null,
    reportJobId: null,
    taskCheckInId: null
  };
  const app = buildApp(store);

  const response = await app.request("/student/tasks/999/check-ins", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileId: "file-1" })
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, "task not found");
});
