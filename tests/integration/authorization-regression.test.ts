import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import { createTeacherRoutes } from "../../src/routes/teacher.ts";
import { createStudentRoutes } from "../../src/routes/student.ts";

const adminApiKey = "admin-secret-key";

const requireStudentAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header("authorization");
  if (!auth || auth !== "Bearer student-token") {
    return c.json({ message: "unauthorized" }, 401);
  }

  c.set("studentAuth", {
    studentId: 1001,
    studentNo: "S20261001"
  });
  await next();
};

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

  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          return {
            token: "student-token",
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
      requireStudentAuth,
      enrollmentProfileService: {
        async getEnrollmentProfile() {
          return {
            status: "complete" as const,
            profile: {
              studentNo: "S20261001",
              name: "张三",
              schoolName: "示例大学",
              majorName: "计算机",
              score: 620,
              admissionYear: 2026
            }
          };
        }
      }
    })
  );

  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: {
        async getMyStudents() {
          return { page: 1, pageSize: 20, total: 0, items: [] };
        }
      },
      teacherStudentDetailService: {
        async getStudentDetail() {
          return null as never;
        }
      },
      teacherActivityExecutionService: {
        async executeActivity() {
          return { recordId: 1, status: "submitted" as const };
        }
      }
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
      }
    })
  );

  return app;
};

test("authorization regression: Student/Teacher/Admin cross-role privilege escalation should be blocked", async () => {
  const app = createApp();

  const cases: Array<{
    name: string;
    url: string;
    method?: "GET" | "POST" | "DELETE";
    headers?: Record<string, string>;
    body?: string;
    expectedStatus: number;
  }> = [
    {
      name: "student token cannot access admin grant",
      url: "/admin/authorizations/grants",
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer student-token" },
      body: JSON.stringify({ grantType: "class", teacherId: "T-1", targetId: 11 }),
      expectedStatus: 403
    },
    {
      name: "teacher id cannot access admin dashboard",
      url: "/admin/dashboard/cockpit",
      headers: { "x-teacher-id": "T-1" },
      expectedStatus: 403
    },
    {
      name: "admin key cannot access teacher route without teacher role",
      url: "/teacher/my-students",
      headers: { "x-admin-key": adminApiKey },
      expectedStatus: 401
    },
    {
      name: "admin key cannot access student route without student auth",
      url: "/student/assessments/questions",
      headers: { "x-admin-key": adminApiKey },
      expectedStatus: 401
    },
    {
      name: "anonymous cannot access student enrollment profile",
      url: "/auth/student/enrollment-profile",
      expectedStatus: 401
    },
    {
      name: "anonymous cannot access teacher execute endpoint",
      url: "/teacher/activities/1/execute",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: { score: 90 } }),
      expectedStatus: 401
    }
  ];

  for (const item of cases) {
    const response = await app.request(item.url, {
      method: item.method ?? "GET",
      headers: item.headers,
      body: item.body
    });

    assert.equal(response.status, item.expectedStatus, item.name);
  }

  assert.equal(cases.length, 6);
});
