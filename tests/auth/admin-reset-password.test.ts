import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";
import {
  createStudentAuthService,
  type StudentAuthRecord,
  type StudentAuthRepository,
  type StudentPasswordUpdateInput
} from "../../src/modules/auth/service.ts";

const adminApiKey = "admin-secret-key";

interface TestContext {
  student: StudentAuthRecord | null;
  updateInputs: StudentPasswordUpdateInput[];
  auditActions: string[];
}

function buildStudentRepo(ctx: TestContext): StudentAuthRepository {
  return {
    async findStudentByNo() {
      return null;
    },
    async findStudentById(studentId) {
      if (ctx.student && studentId === ctx.student.id) {
        return ctx.student;
      }

      return null;
    },
    async updateStudentPassword(input) {
      ctx.updateInputs.push(input);
    }
  };
}

function buildApp(ctx: TestContext): Hono {
  const service = createStudentAuthService({
    studentRepo: buildStudentRepo(ctx),
    passwordVerifier: {
      async compare() {
        return false;
      }
    },
    passwordHasher: {
      async hash(password) {
        return `hashed:${password}`;
      }
    },
    tokenSigner: {
      expiresIn: 3600,
      signStudentToken() {
        return "unused";
      }
    }
  });

  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      studentAuthService: service,
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
          return;
        }
      },
      auditLogService: {
        async logAuthorizationGrant() {
          ctx.auditActions.push("authorization_grant");
        },
        async logAuthorizationRevoke() {
          ctx.auditActions.push("authorization_revoke");
        },
        async logPasswordReset() {
          ctx.auditActions.push("password_reset");
        },
        async logActivityPublish() {
          ctx.auditActions.push("activity_publish");
        }
      },
      adminApiKey
    })
  );

  return app;
}

test("POST /admin/students/:id/reset-password should return 403 when X-Admin-Key is missing or invalid", async () => {
  const ctx: TestContext = {
    student: {
      id: 1001,
      studentNo: "S20261001",
      passwordHash: "old-hash",
      mustChangePassword: false
    },
    updateInputs: [],
    auditActions: []
  };

  const app = buildApp(ctx);

  const missingKeyResponse = await app.request("/admin/students/1001/reset-password", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      newPassword: "NewPass123!"
    })
  });

  assert.equal(missingKeyResponse.status, 403);
  assert.deepEqual(await missingKeyResponse.json(), {
    message: "forbidden"
  });

  const wrongKeyResponse = await app.request("/admin/students/1001/reset-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": "wrong-key"
    },
    body: JSON.stringify({
      newPassword: "NewPass123!"
    })
  });

  assert.equal(wrongKeyResponse.status, 403);
  assert.deepEqual(await wrongKeyResponse.json(), {
    message: "forbidden"
  });
  assert.equal(ctx.updateInputs.length, 0);
  assert.deepEqual(ctx.auditActions, []);
});

test("POST /admin/students/:id/reset-password should update password with mustChangePassword=true when admin key is valid", async () => {
  const ctx: TestContext = {
    student: {
      id: 2002,
      studentNo: "S20262002",
      passwordHash: "old-hash",
      mustChangePassword: false
    },
    updateInputs: [],
    auditActions: []
  };

  const app = buildApp(ctx);

  const response = await app.request("/admin/students/2002/reset-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey
    },
    body: JSON.stringify({
      newPassword: "ResetPass123!"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: "password reset"
  });

  assert.equal(ctx.updateInputs.length, 1);
  const updateInput = ctx.updateInputs[0];

  assert.equal(updateInput.studentId, 2002);
  assert.equal(updateInput.passwordHash, "hashed:ResetPass123!");
  assert.equal(updateInput.mustChangePassword, true);
  assert.ok(updateInput.passwordUpdatedAt instanceof Date);
  assert.deepEqual(ctx.auditActions, ["password_reset"]);
});

test("POST /admin/students/:id/reset-password should return 404 when student does not exist", async () => {
  const ctx: TestContext = {
    student: null,
    updateInputs: [],
    auditActions: []
  };

  const app = buildApp(ctx);

  const response = await app.request("/admin/students/9999/reset-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey
    },
    body: JSON.stringify({
      newPassword: "ResetPass123!"
    })
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    message: "student not found"
  });

  assert.equal(ctx.updateInputs.length, 0);
  assert.deepEqual(ctx.auditActions, []);
});

test("POST /admin/students/:id/reset-password should return 400 when newPassword is blank or too short", async () => {
  for (const newPassword of ["      ", "short1!"]) {
    const ctx: TestContext = {
      student: {
        id: 3003,
        studentNo: "S20263003",
        passwordHash: "old-hash",
        mustChangePassword: false
      },
      updateInputs: [],
      auditActions: []
    };

    const app = buildApp(ctx);

    const response = await app.request("/admin/students/3003/reset-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Admin-Key": adminApiKey
      },
      body: JSON.stringify({
        newPassword
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      message: "newPassword is required and must be at least 8 characters"
    });
    assert.equal(ctx.updateInputs.length, 0);
    assert.deepEqual(ctx.auditActions, []);
  }
});

test("POST /admin/students/:id/reset-password should reject non-integer student id format", async () => {
  const ctx: TestContext = {
    student: {
      id: 1000,
      studentNo: "S20261000",
      passwordHash: "old-hash",
      mustChangePassword: false
    },
    updateInputs: [],
    auditActions: []
  };

  const app = buildApp(ctx);

  const response = await app.request("/admin/students/1e3/reset-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Admin-Key": adminApiKey
    },
    body: JSON.stringify({
      newPassword: "ResetPass123!"
    })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "invalid student id"
  });
  assert.equal(ctx.updateInputs.length, 0);
  assert.deepEqual(ctx.auditActions, []);
});
