import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAdminRoutes } from "../../src/routes/admin.ts";

const baseDependencies = {
  studentAuthService: {
    async resetStudentPasswordByAdmin() {
      return;
    }
  },
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
      return { activityId: 1 };
    }
  },
  auditLogService: {
    async logAuthorizationGrant() {
      return;
    },
    async logAuthorizationRevoke() {
      return;
    },
    async logPasswordReset() {
      return;
    },
    async logActivityPublish() {
      return;
    }
  },
  adminApiKey: "admin-key"
} as const;

test("admin org CRUD should require admin key", async () => {
  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      ...baseDependencies,
      adminOrgService: {
        async createCollege() {
          return { collegeId: 1 };
        },
        async updateCollege() {
          return;
        },
        async deleteCollege() {
          return;
        }
      }
    })
  );

  const response = await app.request("/admin/org/colleges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schoolId: 1, name: "计算机学院" })
  });

  assert.equal(response.status, 403);
});

test("admin should create college and teacher account", async () => {
  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      ...baseDependencies,
      adminOrgService: {
        async createCollege() {
          return { collegeId: 2 };
        },
        async updateCollege() {
          return;
        },
        async deleteCollege() {
          return;
        }
      },
      teacherAccountService: {
        async createTeacherAccount() {
          return { teacherId: "T-1001" };
        },
        async updateTeacherStatus() {
          return;
        },
        async resetTeacherPassword() {
          return;
        }
      }
    })
  );

  const collegeResp = await app.request("/admin/org/colleges", {
    method: "POST",
    headers: { "x-admin-key": "admin-key", "content-type": "application/json" },
    body: JSON.stringify({ schoolId: 1, name: "计算机学院" })
  });
  assert.equal(collegeResp.status, 200);
  assert.equal((await collegeResp.json()).collegeId, 2);

  const teacherResp = await app.request("/admin/teachers", {
    method: "POST",
    headers: { "x-admin-key": "admin-key", "content-type": "application/json" },
    body: JSON.stringify({ name: "李老师", account: "t_li", password: "Passw0rd!", status: "active" })
  });
  assert.equal(teacherResp.status, 200);
  assert.equal((await teacherResp.json()).teacherId, "T-1001");
});

test("admin should freeze teacher account and reset password", async () => {
  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      ...baseDependencies,
      teacherAccountService: {
        async createTeacherAccount() {
          return { teacherId: "T-1001" };
        },
        async updateTeacherStatus() {
          return;
        },
        async resetTeacherPassword() {
          return;
        }
      }
    })
  );

  const freezeResp = await app.request("/admin/teachers/T-1001/status", {
    method: "PATCH",
    headers: { "x-admin-key": "admin-key", "content-type": "application/json" },
    body: JSON.stringify({ status: "frozen" })
  });
  assert.equal(freezeResp.status, 200);

  const resetResp = await app.request("/admin/teachers/T-1001/reset-password", {
    method: "POST",
    headers: { "x-admin-key": "admin-key", "content-type": "application/json" },
    body: JSON.stringify({ newPassword: "NewPassw0rd!" })
  });
  assert.equal(resetResp.status, 200);
});
