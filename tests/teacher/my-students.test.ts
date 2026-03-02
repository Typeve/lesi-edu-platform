import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createTeacherMyStudentsService, type TeacherMyStudentsRepository } from "../../src/modules/teacher/my-students.ts";
import { createAuthorizationGrantService } from "../../src/modules/authorization/grant-service.ts";
import { createTeacherRoutes } from "../../src/routes/teacher.ts";

test("teacher my students service should keep stable pagination order by studentId", async () => {
  const repo: TeacherMyStudentsRepository = {
    async listAuthorizedStudents() {
      return {
        total: 3,
        rows: [
          {
            studentId: 1,
            studentNo: "S1",
            name: "A",
            classId: 1,
            className: "1班",
            majorId: 1,
            majorName: "软件",
            grade: 2022,
            assessmentDone: true,
            reportGenerated: true
          },
          {
            studentId: 2,
            studentNo: "S2",
            name: "B",
            classId: 1,
            className: "1班",
            majorId: 1,
            majorName: "软件",
            grade: 2022,
            assessmentDone: false,
            reportGenerated: false
          },
          {
            studentId: 3,
            studentNo: "S3",
            name: "C",
            classId: 2,
            className: "2班",
            majorId: 2,
            majorName: "法学",
            grade: 2023,
            assessmentDone: false,
            reportGenerated: true
          }
        ]
      };
    }
  };

  const service = createTeacherMyStudentsService({
    teacherMyStudentsRepo: repo
  });

  const result = await service.getMyStudents({
    teacherId: "T-1",
    page: 1,
    pageSize: 20,
    filters: {}
  });

  assert.equal(result.total, 3);
  assert.equal(result.items[0].studentId, 1);
});

test("GET /teacher/my-students should require teacher id", async () => {
  const app = new Hono();
  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: {
        async getMyStudents() {
          return { page: 1, pageSize: 20, total: 0, items: [] };
        }
      }
    })
  );

  const response = await app.request("/teacher/my-students");
  assert.equal(response.status, 401);
});

test("GET /teacher/my-students should support filters and pagination", async () => {
  const app = new Hono();
  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: {
        async getMyStudents(query) {
          assert.equal(query.teacherId, "T-1");
          assert.equal(query.filters.classId, 2);
          assert.equal(query.filters.majorId, 3);
          assert.equal(query.filters.grade, 2022);
          assert.equal(query.filters.assessmentStatus, "done");
          assert.equal(query.filters.reportStatus, "generated");
          assert.equal(query.page, 2);
          assert.equal(query.pageSize, 10);

          return {
            page: 2,
            pageSize: 10,
            total: 1,
            items: [
              {
                studentId: 12,
                studentNo: "S20260012",
                name: "张三",
                classId: 2,
                className: "2班",
                majorId: 3,
                majorName: "计算机",
                grade: 2022,
                assessmentDone: true,
                reportGenerated: true
              }
            ]
          };
        }
      }
    })
  );

  const response = await app.request(
    "/teacher/my-students?page=2&pageSize=10&classId=2&majorId=3&grade=2022&assessmentStatus=done&reportStatus=generated",
    {
      headers: {
        "x-teacher-id": "T-1"
      }
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.total, 1);
  assert.equal(payload.items[0].studentNo, "S20260012");
});

test("teacher visible students should be affected immediately after grant and revoke", async () => {
  const teacherId = "T-1";
  const classGrants = new Set<number>();
  const studentsByClass = new Map<number, number[]>([
    [10, [1001, 1002]]
  ]);

  const grantService = createAuthorizationGrantService({
    authorizationGrantRepo: {
      async assignStudentGrant() {},
      async revokeStudentGrant() {},
      async assignClassGrant(_teacherId, classId) {
        classGrants.add(classId);
      },
      async revokeClassGrant(_teacherId, classId) {
        classGrants.delete(classId);
      }
    }
  });

  const service = createTeacherMyStudentsService({
    teacherMyStudentsRepo: {
      async listAuthorizedStudents(query) {
        assert.equal(query.teacherId, teacherId);
        const rows = Array.from(classGrants).flatMap((classId) =>
          (studentsByClass.get(classId) ?? []).map((studentId) => ({
            studentId,
            studentNo: `S${studentId}`,
            name: `学生${studentId}`,
            classId,
            className: `${classId}班`,
            majorId: null,
            majorName: null,
            grade: 2024,
            assessmentDone: false,
            reportGenerated: false
          }))
        );
        return { total: rows.length, rows };
      }
    }
  });

  const beforeGrant = await service.getMyStudents({
    teacherId,
    page: 1,
    pageSize: 20,
    filters: {}
  });
  assert.equal(beforeGrant.total, 0);

  await grantService.assignGrant({
    grantType: "class",
    teacherId,
    targetId: 10,
    accessLevel: "manage"
  });
  const afterGrant = await service.getMyStudents({
    teacherId,
    page: 1,
    pageSize: 20,
    filters: {}
  });
  assert.equal(afterGrant.total, 2);

  await grantService.revokeGrant({
    grantType: "class",
    teacherId,
    targetId: 10
  });
  const afterRevoke = await service.getMyStudents({
    teacherId,
    page: 1,
    pageSize: 20,
    filters: {}
  });
  assert.equal(afterRevoke.total, 0);
});
