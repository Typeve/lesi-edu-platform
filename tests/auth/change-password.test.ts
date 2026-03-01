import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import {
  createStudentAuthService,
  type StudentAuthRecord,
  type StudentAuthRepository
} from "../../src/modules/auth/service.ts";
import {
  bcryptPasswordHasher,
  bcryptPasswordVerifier
} from "../../src/modules/auth/password.ts";
import {
  createJwtTokenSigner,
  createJwtTokenVerifier
} from "../../src/modules/auth/token.ts";
import { createStudentAuthMiddleware } from "../../src/middleware/auth.ts";

const jwtSecret = "a".repeat(32);
const changePasswordPath = "/auth/student/change-password";

interface TestContext {
  student: StudentAuthRecord & { passwordUpdatedAt: Date | null };
  updateCount: number;
}

async function buildStudentContext(): Promise<TestContext> {
  return {
    student: {
      id: 7,
      studentNo: "S20260007",
      passwordHash: await bcrypt.hash("OldPass1!", 4),
      mustChangePassword: true,
      passwordUpdatedAt: null
    },
    updateCount: 0
  };
}

function buildStudentRepo(ctx: TestContext): StudentAuthRepository {
  return {
    async findStudentByNo(studentNo) {
      return studentNo === ctx.student.studentNo ? ctx.student : null;
    },
    async findStudentById(studentId) {
      return studentId === ctx.student.id ? ctx.student : null;
    },
    async updateStudentPassword({ studentId, passwordHash, passwordUpdatedAt, mustChangePassword }) {
      if (studentId !== ctx.student.id) {
        return;
      }

      ctx.updateCount += 1;
      ctx.student.passwordHash = passwordHash;
      ctx.student.passwordUpdatedAt = passwordUpdatedAt;
      ctx.student.mustChangePassword = mustChangePassword;
    }
  };
}

function buildApp(ctx: TestContext): Hono {
  const studentRepo = buildStudentRepo(ctx);

  const service = createStudentAuthService({
    studentRepo,
    passwordVerifier: bcryptPasswordVerifier,
    passwordHasher: bcryptPasswordHasher,
    tokenSigner: createJwtTokenSigner({
      secret: jwtSecret,
      expiresInDays: 7
    })
  });

  const requireStudentAuth = createStudentAuthMiddleware({
    tokenVerifier: createJwtTokenVerifier({ secret: jwtSecret }),
    studentRepo,
    changePasswordPath
  });

  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: service,
      requireStudentAuth
    })
  );

  return app;
}

function signStudentToken(ctx: TestContext): string {
  return createJwtTokenSigner({
    secret: jwtSecret,
    expiresInDays: 7
  }).signStudentToken({
    studentId: ctx.student.id,
    studentNo: ctx.student.studentNo
  });
}

test("POST /auth/student/change-password should return 401 when Authorization header is missing", async () => {
  const ctx = await buildStudentContext();
  const app = buildApp(ctx);

  const response = await app.request(changePasswordPath, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "OldPass1!",
      newPassword: "NewPass2@"
    })
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    message: "unauthorized"
  });

  assert.equal(ctx.updateCount, 0);
});

test("POST /auth/student/change-password should accept case-insensitive Bearer scheme with multiple spaces", async () => {
  const ctx = await buildStudentContext();
  const app = buildApp(ctx);

  const response = await app.request(changePasswordPath, {
    method: "POST",
    headers: {
      authorization: `bEaReR    ${signStudentToken(ctx)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "OldPass1!",
      newPassword: "NewPass2@"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: "password changed"
  });
  assert.equal(ctx.updateCount, 1);
});

test("POST /auth/student/change-password should change password when old password is correct", async () => {
  const ctx = await buildStudentContext();
  const app = buildApp(ctx);

  const response = await app.request(changePasswordPath, {
    method: "POST",
    headers: {
      authorization: `Bearer ${signStudentToken(ctx)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "OldPass1!",
      newPassword: "NewPass2@"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: "password changed"
  });

  assert.equal(ctx.updateCount, 1);
  assert.equal(ctx.student.mustChangePassword, false);
  assert.ok(ctx.student.passwordUpdatedAt instanceof Date);

  const updatedHash = ctx.student.passwordHash;
  assert.ok(updatedHash);
  assert.equal(await bcrypt.compare("NewPass2@", updatedHash), true);
  assert.equal(await bcrypt.compare("OldPass1!", updatedHash), false);
});

test("POST /auth/student/change-password should reject when old password is incorrect", async () => {
  const ctx = await buildStudentContext();
  const app = buildApp(ctx);
  const originalHash = ctx.student.passwordHash;

  const response = await app.request(changePasswordPath, {
    method: "POST",
    headers: {
      authorization: `Bearer ${signStudentToken(ctx)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "WrongOld1!",
      newPassword: "NewPass2@"
    })
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    message: "invalid old password"
  });

  assert.equal(ctx.updateCount, 0);
  assert.equal(ctx.student.passwordHash, originalHash);
  assert.equal(ctx.student.mustChangePassword, true);
  assert.equal(ctx.student.passwordUpdatedAt, null);
});

test("mustChangePassword=true should block non-change-password protected routes with 403", async () => {
  const ctx = await buildStudentContext();

  const studentRepo = buildStudentRepo(ctx);
  const requireStudentAuth = createStudentAuthMiddleware({
    tokenVerifier: createJwtTokenVerifier({ secret: jwtSecret }),
    studentRepo,
    changePasswordPath
  });

  const app = new Hono();
  app.get("/protected/dummy", requireStudentAuth, (c) => c.json({ ok: true }));

  const response = await app.request("/protected/dummy", {
    method: "GET",
    headers: {
      authorization: `Bearer ${signStudentToken(ctx)}`
    }
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    message: "password change required"
  });
});
