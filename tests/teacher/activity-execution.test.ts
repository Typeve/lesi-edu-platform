import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import {
  TeacherActivityForbiddenError,
  createTeacherActivityExecutionService,
  type TeacherActivityExecutionRepository
} from "../../src/modules/teacher/activity-execution.ts";
import { createTeacherRoutes } from "../../src/routes/teacher.ts";

const resolveTeacherIdFromLegacyHeader = (request: {
  req: { header(name: string): string | undefined };
}): string | null => {
  const teacherId = request.req.header("x-teacher-id")?.trim();
  return teacherId?.length ? teacherId : null;
};

test("teacher activity execution service should upsert execution payload", async () => {
  let saved = 0;
  const repo: TeacherActivityExecutionRepository = {
    async isTeacherAssigned() {
      return true;
    },
    async upsertExecutionRecord() {
      saved += 1;
      return 1;
    }
  };

  const service = createTeacherActivityExecutionService({
    teacherActivityExecutionRepo: repo
  });

  const result = await service.executeActivity({
    teacherId: "T-1",
    activityId: 10,
    payload: {
      groupings: [{ groupName: "A组", studentNos: ["S1"] }],
      signInMaterials: ["签到表"],
      result: { award: "一等奖" }
    }
  });

  assert.equal(result.recordId, 1);
  assert.equal(saved, 1);
});

test("teacher activity execution service should throw forbidden when teacher not assigned", async () => {
  const repo: TeacherActivityExecutionRepository = {
    async isTeacherAssigned() {
      return false;
    },
    async upsertExecutionRecord() {
      return 1;
    }
  };

  const service = createTeacherActivityExecutionService({
    teacherActivityExecutionRepo: repo
  });

  await assert.rejects(
    async () => {
      await service.executeActivity({ teacherId: "T-1", activityId: 10, payload: {} });
    },
    (error: unknown) => error instanceof TeacherActivityForbiddenError
  );
});

test("POST /teacher/activities/:id/execute should return 403 when teacher not assigned", async () => {
  const app = new Hono();
  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: { async getMyStudents() { return { page: 1, pageSize: 20, total: 0, items: [] }; } },
      teacherStudentDetailService: { async getStudentDetail() { throw new Error("not implemented"); } },
      teacherActivityExecutionService: {
        async executeActivity() {
          throw new TeacherActivityForbiddenError();
        }
      },
      resolveTeacherId: resolveTeacherIdFromLegacyHeader
    })
  );

  const response = await app.request("/teacher/activities/10/execute", {
    method: "POST",
    headers: { "x-teacher-id": "T-1", "content-type": "application/json" },
    body: JSON.stringify({ result: { score: 95 } })
  });

  assert.equal(response.status, 403);
});

test("POST /teacher/activities/:id/execute should return submitted record id", async () => {
  const app = new Hono();
  app.route(
    "/teacher",
    createTeacherRoutes({
      teacherMyStudentsService: { async getMyStudents() { return { page: 1, pageSize: 20, total: 0, items: [] }; } },
      teacherStudentDetailService: { async getStudentDetail() { throw new Error("not implemented"); } },
      teacherActivityExecutionService: {
        async executeActivity() {
          return { recordId: 9, status: "submitted" as const };
        }
      },
      resolveTeacherId: resolveTeacherIdFromLegacyHeader
    })
  );

  const response = await app.request("/teacher/activities/10/execute", {
    method: "POST",
    headers: { "x-teacher-id": "T-1", "content-type": "application/json" },
    body: JSON.stringify({ result: { score: 95 } })
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.recordId, 9);
});
