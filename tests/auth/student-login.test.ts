import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Hono } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import type { StudentAuthRepository } from "../../src/modules/auth/service.ts";
import { createJwtTokenSigner, type StudentTokenSigner } from "../../src/modules/auth/token.ts";

const loginPath = "/auth/student/login";

function mountAuthApp(
  studentRepo: StudentAuthRepository,
  tokenSigner: StudentTokenSigner
): Hono {
  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentRepo,
      tokenSigner
    })
  );
  return app;
}

test("POST /auth/student/login should return token, expiresIn, mustChangePassword on success", async () => {
  const student = {
    id: 101,
    studentNo: "S20260001",
    passwordHash: await bcrypt.hash("Passw0rd!", 4),
    mustChangePassword: true
  };

  const studentRepo: StudentAuthRepository = {
    async findStudentByNo(studentNo) {
      return studentNo === student.studentNo ? student : null;
    }
  };

  let signedPayload: { studentId: number; studentNo: string } | null = null;
  const tokenSigner: StudentTokenSigner = {
    expiresIn: 7 * 24 * 60 * 60,
    signStudentToken(payload) {
      signedPayload = payload;
      return "fake.jwt.token";
    }
  };

  const app = mountAuthApp(studentRepo, tokenSigner);

  const response = await app.request(loginPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      studentNo: student.studentNo,
      password: "Passw0rd!"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    token: "fake.jwt.token",
    expiresIn: 7 * 24 * 60 * 60,
    mustChangePassword: true
  });
  assert.deepEqual(signedPayload, {
    studentId: 101,
    studentNo: "S20260001"
  });
});

test("POST /auth/student/login should return unified 401 for missing account, wrong password, empty password hash", async () => {
  const validHash = await bcrypt.hash("CorrectPass1!", 4);

  const studentRepo: StudentAuthRepository = {
    async findStudentByNo(studentNo) {
      if (studentNo === "S-EXIST") {
        return {
          id: 1,
          studentNo,
          passwordHash: validHash,
          mustChangePassword: false
        };
      }

      if (studentNo === "S-EMPTY") {
        return {
          id: 2,
          studentNo,
          passwordHash: null,
          mustChangePassword: true
        };
      }

      return null;
    }
  };

  const tokenSigner: StudentTokenSigner = {
    expiresIn: 7 * 24 * 60 * 60,
    signStudentToken() {
      return "should-not-be-called";
    }
  };

  const app = mountAuthApp(studentRepo, tokenSigner);

  const cases = [
    { studentNo: "S-NOT-FOUND", password: "whatever" },
    { studentNo: "S-EXIST", password: "WrongPass1!" },
    { studentNo: "S-EMPTY", password: "AnyPass1!" }
  ];

  for (const credentials of cases) {
    const response = await app.request(loginPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials)
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      message: "invalid studentNo or password"
    });
  }
});

test("createJwtTokenSigner should sign JWT with expiresInDays", () => {
  const signer = createJwtTokenSigner({
    secret: "x".repeat(32),
    expiresInDays: 7
  });

  const token = signer.signStudentToken({
    studentId: 88,
    studentNo: "S202688"
  });

  const payload = jwt.decode(token);

  assert.ok(payload && typeof payload === "object");
  assert.equal(payload.sub, "88");
  assert.equal(payload.studentNo, "S202688");
  assert.equal(payload.role, "student");
  assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);
});
