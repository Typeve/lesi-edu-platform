import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createResourceAuthorizationMiddleware } from "../../src/middleware/resource-authorization.ts";
import {
  createResourceAuthorizationService,
  type AuthorizationRepository,
  type ResourceType
} from "../../src/modules/authorization/service.ts";
import { createResourcesRoutes } from "../../src/routes/resources.ts";

interface AuthorizationFixture {
  resourceStudents: Record<ResourceType, Record<number, number>>;
  studentClasses: Record<number, number>;
  studentGrants: Record<string, Set<number>>;
  classGrants: Record<string, Set<number>>;
}

const createAuthorizationRepository = (fixture: AuthorizationFixture): AuthorizationRepository => ({
  async findResourceStudentId(resourceType, resourceId) {
    return fixture.resourceStudents[resourceType][resourceId] ?? null;
  },
  async hasTeacherStudentGrant(teacherId, studentId) {
    return fixture.studentGrants[teacherId]?.has(studentId) ?? false;
  },
  async findStudentClassId(studentId) {
    return fixture.studentClasses[studentId] ?? null;
  },
  async hasTeacherClassGrant(teacherId, classId) {
    return fixture.classGrants[teacherId]?.has(classId) ?? false;
  }
});

const createApp = (fixture: AuthorizationFixture) => {
  const service = createResourceAuthorizationService({
    authorizationRepo: createAuthorizationRepository(fixture)
  });

  const app = new Hono();
  app.use("/resources/*", async (c, next) => {
    const teacherId = c.req.header("x-teacher-id") ?? c.req.header("X-Teacher-Id");
    if (!teacherId) {
      return c.json({ message: "unauthorized" }, 401);
    }

    c.set("auth", {
      sub: teacherId,
      role: "teacher",
      account: teacherId,
      teacherId
    });
    await next();
  });

  app.route(
    "/resources",
    createResourcesRoutes({
      createResourceAuthorization: (resourceType) =>
        createResourceAuthorizationMiddleware({
          resourceType,
          authorizationService: service,
          hasPermission: () => true
        })
    })
  );

  return app;
};

const baseFixture: AuthorizationFixture = {
  resourceStudents: {
    report: { 101: 1 },
    task: { 201: 2 },
    certificate: { 301: 3 },
    profile: { 401: 4 }
  },
  studentClasses: {
    1: 11,
    2: 22,
    3: 33,
    4: 44
  },
  studentGrants: {
    "teacher-student": new Set([1])
  },
  classGrants: {
    "teacher-class": new Set([22, 33, 44])
  }
};

test("resource authorization should return 401 when X-Teacher-Id is missing", async () => {
  const app = createApp(baseFixture);

  const res = await app.request("/resources/reports/101");
  assert.equal(res.status, 401);
});

test("resource authorization should return 404 when resource does not exist", async () => {
  const app = createApp(baseFixture);

  const res = await app.request("/resources/reports/999", {
    headers: {
      "X-Teacher-Id": "teacher-student"
    }
  });

  assert.equal(res.status, 404);
});

test("resource authorization should allow teacher by student-level grant", async () => {
  const app = createApp(baseFixture);

  const res = await app.request("/resources/reports/101", {
    headers: {
      "X-Teacher-Id": "teacher-student"
    }
  });

  assert.equal(res.status, 200);
});

test("resource authorization should allow teacher by class-level fallback grant", async () => {
  const app = createApp(baseFixture);

  const res = await app.request("/resources/tasks/201", {
    headers: {
      "X-Teacher-Id": "teacher-class"
    }
  });

  assert.equal(res.status, 200);
});

test("resource authorization should return 403 when teacher is not granted", async () => {
  const app = createApp(baseFixture);

  const res = await app.request("/resources/reports/101", {
    headers: {
      "X-Teacher-Id": "teacher-none"
    }
  });

  assert.equal(res.status, 403);
});

test("resource authorization should cover all four resource routes", async () => {
  const app = createApp(baseFixture);

  const headers = {
    "X-Teacher-Id": "teacher-class"
  };

  const routes = ["/resources/tasks/201", "/resources/certificates/301", "/resources/profiles/401"];

  for (const route of routes) {
    const res = await app.request(route, { headers });
    assert.equal(res.status, 200, route);
  }
});
