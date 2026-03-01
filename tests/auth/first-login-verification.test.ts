import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import { Hono } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import {
  createStudentFirstLoginVerificationService,
  StudentFirstLoginVerificationMismatchError,
  type StudentFirstLoginVerificationRepository
} from "../../src/modules/auth/first-login-verification.ts";
import { createStudentAuthMiddleware } from "../../src/middleware/auth.ts";
import { createJwtTokenSigner, createJwtTokenVerifier } from "../../src/modules/auth/token.ts";
import { createStudentRoutes } from "../../src/routes/student.ts";

const jwtSecret = "b".repeat(32);

const signToken = (studentId: number, studentNo: string): string => {
  return createJwtTokenSigner({
    secret: jwtSecret,
    expiresInDays: 7
  }).signStudentToken({ studentId, studentNo });
};

test("first-login verification service should throw readable mismatch reasons", async () => {
  const repository: StudentFirstLoginVerificationRepository = {
    async findStudentFirstLoginReference() {
      return {
        studentId: 1,
        name: "张三",
        credentialNo: "440101199901011234",
        schoolName: "华南理工大学",
        majorName: "软件工程",
        firstLoginVerifiedAt: null
      };
    },
    async markStudentFirstLoginVerified() {
      return;
    }
  };

  const service = createStudentFirstLoginVerificationService({
    studentFirstLoginVerificationRepo: repository,
    nowProvider: () => new Date("2026-03-01T00:00:00Z")
  });

  await assert.rejects(
    async () => {
      await service.verifyStudentFirstLogin({
        studentId: 1,
        name: "李四",
        credentialNo: "440101199901011111",
        schoolName: "华南理工大学",
        majorName: "计算机科学"
      });
    },
    (error) => {
      assert.ok(error instanceof StudentFirstLoginVerificationMismatchError);
      assert.deepEqual(error.reasons, ["姓名不匹配", "证件号不匹配", "专业信息不匹配"]);
      return true;
    }
  );
});

test("POST /auth/student/first-login-verify should return 400 when body invalid", async () => {
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
      studentFirstLoginVerificationService: {
        async verifyStudentFirstLogin() {
          return {
            verified: true,
            verifiedAt: "2026-03-01T00:00:00.000Z"
          };
        }
      },
      requireStudentAuth
    })
  );

  const response = await app.request("/auth/student/first-login-verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signToken(1, "S20260001")}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: "张三"
    })
  });

  assert.equal(response.status, 400);
});

test("POST /auth/student/first-login-verify should return readable mismatch reasons", async () => {
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
      studentFirstLoginVerificationService: {
        async verifyStudentFirstLogin() {
          throw new StudentFirstLoginVerificationMismatchError([
            "姓名不匹配",
            "证件号不匹配"
          ]);
        }
      },
      requireStudentAuth
    })
  );

  const response = await app.request("/auth/student/first-login-verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signToken(1, "S20260001")}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: "张三",
      credentialNo: "440101199901011234",
      schoolName: "华南理工大学",
      majorName: "软件工程"
    })
  });

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    message: "first login verification failed",
    reasons: ["姓名不匹配", "证件号不匹配"]
  });
});

test("POST /auth/student/first-login-verify should persist verification state", async () => {
  const calls: Array<{ studentId: number }> = [];

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
      studentFirstLoginVerificationService: {
        async verifyStudentFirstLogin(input) {
          calls.push({ studentId: input.studentId });
          return {
            verified: true,
            verifiedAt: "2026-03-01T00:00:00.000Z"
          };
        }
      },
      requireStudentAuth
    })
  );

  const response = await app.request("/auth/student/first-login-verify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signToken(1, "S20260001")}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: "张三",
      credentialNo: "440101199901011234",
      schoolName: "华南理工大学",
      majorName: "软件工程"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    verified: true,
    verifiedAt: "2026-03-01T00:00:00.000Z"
  });
  assert.deepEqual(calls, [{ studentId: 1 }]);
});

test("student core route should return 403 before first-login verification", async () => {
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
    "/student",
    createStudentRoutes({
      requireStudentAuth,
      certificateUploadService: {
        async uploadCertificate() {
          return {
            fileId: "cert_xxx"
          };
        }
      }
    })
  );

  const formData = new FormData();
  formData.append("file", new File([Buffer.from("ok")], "proof.jpg", { type: "image/jpeg" }));

  const response = await app.request("/student/certificates/upload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signToken(1, "S20260001")}`
    },
    body: formData
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    message: "first login verification required"
  });
});
