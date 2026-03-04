import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import { SessionUnauthorizedError } from "../../src/modules/auth/session-service.ts";
import {
  UnifiedAuthFrozenError,
  UnifiedAuthUnauthorizedError,
  UnifiedAuthUnsupportedError
} from "../../src/modules/auth/unified-service.ts";

const requireAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (authHeader !== "Bearer valid-token") {
    return c.json({ message: "unauthorized" }, 401);
  }

  c.set("auth", {
    sub: "T-1",
    role: "teacher",
    account: "teacher001",
    teacherId: "T-1",
    displayName: "张老师"
  });

  await next();
};

const buildApp = () => {
  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          return { token: "student-token", expiresIn: 3600, mustChangePassword: false };
        },
        async changeStudentPassword() {
          return;
        },
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      sessionAuthService: {
        async login({ account, password }) {
          if (account === "teacher001" && password === "Passw0rd!") {
            return {
              accessToken: "valid-token",
              expiresIn: 3600,
              refreshToken: "refresh-token",
              refreshExpiresIn: 2592000,
              user: {
                userId: "T-1",
                role: "teacher",
                displayName: "张老师",
                account: "teacher001"
              }
            };
          }
          throw new SessionUnauthorizedError();
        },
        async refresh(refreshToken) {
          if (refreshToken !== "refresh-token") {
            throw new SessionUnauthorizedError();
          }
          return {
            accessToken: "valid-token",
            expiresIn: 3600,
            refreshToken: "refresh-token-2",
            refreshExpiresIn: 2592000,
            user: {
              userId: "T-1",
              role: "teacher",
              displayName: "张老师",
              account: "teacher001"
            }
          };
        },
        async logout() {
          return;
        },
        async me() {
          return {
            sub: "T-1",
            role: "teacher",
            account: "teacher001"
          };
        }
      },
      unifiedAuthService: {
        async changePassword({ role, subjectId, oldPassword, newPassword }) {
          if (role !== "teacher" || subjectId !== "T-1") {
            throw new UnifiedAuthUnauthorizedError();
          }
          if (oldPassword !== "Passw0rd!") {
            throw new UnifiedAuthUnauthorizedError();
          }
          if (newPassword.length < 8) {
            throw new UnifiedAuthUnsupportedError("new password too short");
          }
        }
      },
      requireAuth
    })
  );

  return app;
};

test("POST /auth/login should support unified teacher login", async () => {
  const app = buildApp();

  const response = await app.request("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      account: "teacher001",
      password: "Passw0rd!"
    })
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.user.role, "teacher");
  assert.equal(payload.accessToken, "valid-token");
});

test("POST /auth/login should return 401 on invalid account/password", async () => {
  const app = buildApp();

  const response = await app.request("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      account: "teacher001",
      password: "wrong"
    })
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    message: "unauthorized"
  });
});

test("GET /auth/me should require bearer token", async () => {
  const app = buildApp();

  const unauthorized = await app.request("/auth/me");
  assert.equal(unauthorized.status, 401);

  const response = await app.request("/auth/me", {
    headers: {
      authorization: "Bearer valid-token"
    }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.role, "teacher");
  assert.equal(payload.teacherId, "T-1");
});

test("POST /auth/change-password should validate and call unified auth service", async () => {
  const app = buildApp();

  const success = await app.request("/auth/change-password", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "Passw0rd!",
      newPassword: "NewPass2@"
    })
  });
  assert.equal(success.status, 200);

  const failed = await app.request("/auth/change-password", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "wrong",
      newPassword: "NewPass2@"
    })
  });
  assert.equal(failed.status, 401);

  const unsupported = await app.request("/auth/change-password", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      oldPassword: "Passw0rd!",
      newPassword: "short"
    })
  });
  assert.equal(unsupported.status, 400);
});

test("POST /auth/login should return 403 when account is frozen", async () => {
  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: {
        async loginStudent() {
          return { token: "student-token", expiresIn: 3600, mustChangePassword: false };
        },
        async changeStudentPassword() {
          return;
        },
        async resetStudentPasswordByAdmin() {
          return;
        }
      },
      sessionAuthService: {
        async login() {
          throw new UnifiedAuthFrozenError();
        },
        async refresh() {
          throw new SessionUnauthorizedError();
        },
        async logout() {
          return;
        },
        async me() {
          throw new SessionUnauthorizedError();
        }
      },
      unifiedAuthService: {
        async changePassword() {
          return;
        }
      },
      requireAuth
    })
  );

  const response = await app.request("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      account: "teacher001",
      password: "Passw0rd!"
    })
  });

  assert.equal(response.status, 403);
});
