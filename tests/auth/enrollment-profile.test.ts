import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import {
  createEnrollmentProfileService,
  type EnrollmentProfileRepository
} from "../../src/modules/enrollment/profile.ts";
import { createStudentAuthMiddleware } from "../../src/middleware/auth.ts";
import { createJwtTokenSigner, createJwtTokenVerifier } from "../../src/modules/auth/token.ts";

const jwtSecret = "c".repeat(32);

const signToken = ({ studentId, studentNo }: { studentId: number; studentNo: string }): string => {
  return createJwtTokenSigner({
    secret: jwtSecret,
    expiresInDays: 7
  }).signStudentToken({ studentId, studentNo });
};

test("enrollment profile service should return complete status when all fields exist", async () => {
  const repo: EnrollmentProfileRepository = {
    async findEnrollmentProfileByStudentNo() {
      return {
        studentNo: "S20260001",
        name: "张三",
        schoolName: "华南理工大学",
        majorName: "软件工程",
        score: 612,
        admissionYear: 2022
      };
    }
  };

  const service = createEnrollmentProfileService({
    enrollmentProfileRepo: repo
  });

  const result = await service.getEnrollmentProfile({
    studentNo: "S20260001"
  });

  assert.equal(result.dataStatus, "complete");
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.readonly, true);
  assert.equal(result.profile.score, 612);
});

test("enrollment profile service should return missing status when no profile found", async () => {
  const repo: EnrollmentProfileRepository = {
    async findEnrollmentProfileByStudentNo() {
      return null;
    }
  };

  const service = createEnrollmentProfileService({
    enrollmentProfileRepo: repo
  });

  const result = await service.getEnrollmentProfile({
    studentNo: "S20260001"
  });

  assert.equal(result.dataStatus, "missing");
  assert.ok(result.missingFields.includes("name"));
  assert.ok(result.missingFields.includes("score"));
});

test("GET /auth/student/enrollment-profile should return 401 when token missing", async () => {
  const studentRepo = {
    async findStudentById() {
      return {
        id: 1,
        studentNo: "S20260001",
        passwordHash: "hash",
        mustChangePassword: false,
        firstLoginVerifiedAt: null
      };
    }
  };

  const requireStudentAuth = createStudentAuthMiddleware({
    tokenVerifier: createJwtTokenVerifier({ secret: jwtSecret }),
    studentRepo
  });

  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          throw new Error("not implemented");
        },
        async changeStudentPassword() {
          return;
        },
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      enrollmentProfileService: {
        async getEnrollmentProfile() {
          return {
            studentNo: "S20260001",
            profile: {
              name: "张三",
              schoolName: "华南理工大学",
              majorName: "软件工程",
              score: 612,
              admissionYear: 2022
            },
            dataStatus: "complete" as const,
            missingFields: [],
            readonly: true
          };
        }
      },
      requireStudentAuth
    })
  );

  const response = await app.request("/auth/student/enrollment-profile");
  assert.equal(response.status, 401);
});

test("GET /auth/student/enrollment-profile should return profile after login (even before first-login verify)", async () => {
  const studentRepo = {
    async findStudentById() {
      return {
        id: 1,
        studentNo: "S20260001",
        passwordHash: "hash",
        mustChangePassword: false,
        firstLoginVerifiedAt: null
      };
    }
  };

  const requireStudentAuth = createStudentAuthMiddleware({
    tokenVerifier: createJwtTokenVerifier({ secret: jwtSecret }),
    studentRepo
  });

  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          throw new Error("not implemented");
        },
        async changeStudentPassword() {
          return;
        },
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      enrollmentProfileService: {
        async getEnrollmentProfile() {
          return {
            studentNo: "S20260001",
            profile: {
              name: "张三",
              schoolName: "华南理工大学",
              majorName: "软件工程",
              score: null,
              admissionYear: 2022
            },
            dataStatus: "partial_missing" as const,
            missingFields: ["score"],
            readonly: true
          };
        }
      },
      requireStudentAuth
    })
  );

  const response = await app.request("/auth/student/enrollment-profile", {
    headers: {
      authorization: `Bearer ${signToken({ studentId: 1, studentNo: "S20260001" })}`
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    studentNo: "S20260001",
    profile: {
      name: "张三",
      schoolName: "华南理工大学",
      majorName: "软件工程",
      score: null,
      admissionYear: 2022
    },
    dataStatus: "partial_missing",
    missingFields: ["score"],
    readonly: true
  });
});

test("student should not have API to overwrite enrollment source fields", async () => {
  const studentRepo = {
    async findStudentById() {
      return {
        id: 1,
        studentNo: "S20260001",
        passwordHash: "hash",
        mustChangePassword: false,
        firstLoginVerifiedAt: new Date("2026-03-01T00:00:00Z")
      };
    }
  };

  const requireStudentAuth = createStudentAuthMiddleware({
    tokenVerifier: createJwtTokenVerifier({ secret: jwtSecret }),
    studentRepo
  });

  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          throw new Error("not implemented");
        },
        async changeStudentPassword() {
          return;
        },
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      enrollmentProfileService: {
        async getEnrollmentProfile() {
          return {
            studentNo: "S20260001",
            profile: {
              name: "张三",
              schoolName: "华南理工大学",
              majorName: "软件工程",
              score: 612,
              admissionYear: 2022
            },
            dataStatus: "complete" as const,
            missingFields: [],
            readonly: true
          };
        }
      },
      requireStudentAuth
    })
  );

  const response = await app.request("/auth/student/enrollment-profile", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${signToken({ studentId: 1, studentNo: "S20260001" })}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ score: 100 })
  });

  assert.equal(response.status, 404);
});
