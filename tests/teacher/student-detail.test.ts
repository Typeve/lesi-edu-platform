import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import {
  TeacherStudentDetailForbiddenError,
  createTeacherStudentDetailService,
  type TeacherStudentDetailRepository
} from "../../src/modules/teacher/student-detail.ts";
import { createTeacherRoutes } from "../../src/routes/teacher.ts";

const resolveTeacherIdFromLegacyHeader = (request: {
  req: { header(name: string): string | undefined };
}): string | null => {
  const teacherId = request.req.header("x-teacher-id")?.trim();
  return teacherId?.length ? teacherId : null;
};

test("teacher student detail service should aggregate profile/assessment/report/task/certificate", async () => {
  const repo: TeacherStudentDetailRepository = {
    async isStudentAuthorized() {
      return true;
    },
    async getStudentProfile() {
      return { studentId: 1, studentNo: "S1", name: "张三" };
    },
    async getAssessmentSummary() {
      return { done: true };
    },
    async getReportSummary() {
      return { count: 2 };
    },
    async getTaskSummary() {
      return { count: 3 };
    },
    async listCertificateFiles() {
      return [{ fileId: "f1", originalName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1024 }];
    }
  };

  const service = createTeacherStudentDetailService({
    teacherStudentDetailRepo: repo
  });

  const result = await service.getStudentDetail({
    teacherId: "T-1",
    studentId: 1
  });

  assert.equal(result.profile.studentNo, "S1");
  assert.equal(result.report.count, 2);
  assert.equal(result.task.count, 3);
  assert.equal(result.certificateFiles.length, 1);
});

test("teacher student detail service should reject unauthorized student", async () => {
  const repo: TeacherStudentDetailRepository = {
    async isStudentAuthorized() {
      return false;
    },
    async getStudentProfile() {
      return { studentId: 1, studentNo: "S1", name: "张三" };
    },
    async getAssessmentSummary() {
      return { done: true };
    },
    async getReportSummary() {
      return { count: 0 };
    },
    async getTaskSummary() {
      return { count: 0 };
    },
    async listCertificateFiles() {
      return [];
    }
  };

  const service = createTeacherStudentDetailService({
    teacherStudentDetailRepo: repo
  });

  await assert.rejects(
    async () => {
      await service.getStudentDetail({ teacherId: "T-1", studentId: 1 });
    },
    (error: unknown) => error instanceof TeacherStudentDetailForbiddenError
  );
});

test("GET /teacher/students/:id/detail should return 403 when unauthorized", async () => {
  const app = new Hono();
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
          throw new TeacherStudentDetailForbiddenError();
        }
      },
      resolveTeacherId: resolveTeacherIdFromLegacyHeader
    })
  );

  const response = await app.request("/teacher/students/1/detail", {
    headers: { "x-teacher-id": "T-1" }
  });

  assert.equal(response.status, 403);
});

test("GET /teacher/students/:id/detail should return aggregated detail", async () => {
  const app = new Hono();
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
          return {
            profile: { studentId: 1, studentNo: "S1", name: "张三" },
            assessment: { done: true },
            report: { count: 2 },
            task: { count: 3 },
            certificateFiles: [{ fileId: "f1", originalName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 }]
          };
        }
      },
      resolveTeacherId: resolveTeacherIdFromLegacyHeader
    })
  );

  const response = await app.request("/teacher/students/1/detail", {
    headers: { "x-teacher-id": "T-1" }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.profile.studentNo, "S1");
  assert.equal(payload.certificateFiles.length, 1);
});
