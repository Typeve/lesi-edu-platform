import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createAuthRoutes } from "../../src/routes/auth.ts";
import type { SessionAuthService, SessionUserView } from "../../src/modules/auth/session.ts";

const loginPath = "/auth/login";
const refreshPath = "/auth/refresh";
const logoutPath = "/auth/logout";
const mePath = "/auth/me";
const refreshCookieValue = "refresh-token-001";

const currentUser: SessionUserView = {
  userId: "teacher:T-100",
  role: "teacher",
  account: "teacher.chen",
  name: "陈老师",
  teacherId: "T-100"
};

const baseStudentAuthService = {
  async loginStudent() {
    return { token: "unused", expiresIn: 1, mustChangePassword: false };
  },
  async changeStudentPassword() {
    return;
  },
  async resetStudentPasswordByAdmin() {
    return;
  }
};

const createSessionAuthServiceStub = (): SessionAuthService => {
  return {
    async login() {
      return {
        accessToken: "access-token-001",
        refreshToken: refreshCookieValue,
        expiresIn: 900,
        refreshExpiresIn: 3600,
        user: currentUser
      };
    },
    async refresh() {
      return {
        accessToken: "access-token-002",
        refreshToken: "refresh-token-002",
        expiresIn: 900,
        refreshExpiresIn: 3600,
        user: currentUser
      };
    },
    async logout() {
      return;
    },
    async getSessionUser() {
      return currentUser;
    }
  };
};

const mountAuthApp = (): Hono => {
  const app = new Hono();
  app.route(
    "/auth",
    createAuthRoutes({
      studentAuthService: baseStudentAuthService,
      sessionAuthService: createSessionAuthServiceStub()
    })
  );

  return app;
};

test("POST /auth/login should return access token and set refresh cookie", async () => {
  const app = mountAuthApp();
  const response = await app.request(loginPath, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: "teacher.chen",
      password: "Passw0rd!"
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    accessToken: "access-token-001",
    expiresIn: 900,
    user: currentUser
  });

  const setCookieHeader = response.headers.get("set-cookie");
  assert.ok(setCookieHeader);
  assert.equal(setCookieHeader.includes("refresh_token=refresh-token-001"), true);
  assert.equal(setCookieHeader.includes("HttpOnly"), true);
});

test("POST /auth/refresh should return 401 when refresh cookie is missing", async () => {
  const app = mountAuthApp();
  const response = await app.request(refreshPath, {
    method: "POST"
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    message: "unauthorized"
  });
});

test("POST /auth/logout should clear refresh cookie", async () => {
  const app = mountAuthApp();
  const response = await app.request(logoutPath, {
    method: "POST",
    headers: {
      cookie: "refresh_token=refresh-token-001"
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: "logged out"
  });
  const setCookieHeader = response.headers.get("set-cookie");
  assert.ok(setCookieHeader);
  assert.equal(setCookieHeader.includes("refresh_token="), true);
});

test("GET /auth/me should return current user by Bearer token", async () => {
  const app = mountAuthApp();
  const response = await app.request(mePath, {
    method: "GET",
    headers: {
      authorization: "Bearer access-token-001"
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), currentUser);
});
