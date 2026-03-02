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
    async logAuthorizationGrant() {},
    async logAuthorizationRevoke() {},
    async logPasswordReset() {},
    async logActivityPublish() {}
  },
  adminApiKey: "admin-key"
} as const;

test("admin student archive CRUD should work", async () => {
  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      ...baseDependencies,
      adminStudentArchiveService: {
        async createStudentArchive() {
          return { studentId: 101 };
        },
        async getStudentArchive() {
          return { studentId: 101, studentNo: "S20260001", name: "张三", classId: 1 };
        },
        async updateStudentArchive() {
          return;
        },
        async deleteStudentArchive() {
          return;
        },
        async getEnrollmentLinkStatus() {
          return { status: "linked" as const, reason: null };
        }
      }
    })
  );

  const createResp = await app.request("/admin/students", {
    method: "POST",
    headers: { "x-admin-key": "admin-key", "content-type": "application/json" },
    body: JSON.stringify({ classId: 1, studentNo: "S20260001", name: "张三" })
  });
  assert.equal(createResp.status, 200);
  assert.equal((await createResp.json()).studentId, 101);

  const detailResp = await app.request("/admin/students/101", {
    headers: { "x-admin-key": "admin-key" }
  });
  assert.equal(detailResp.status, 200);

  const updateResp = await app.request("/admin/students/101", {
    method: "PATCH",
    headers: { "x-admin-key": "admin-key", "content-type": "application/json" },
    body: JSON.stringify({ name: "李四" })
  });
  assert.equal(updateResp.status, 200);

  const linkResp = await app.request("/admin/students/101/enrollment-link", {
    headers: { "x-admin-key": "admin-key" }
  });
  assert.equal(linkResp.status, 200);
  assert.equal((await linkResp.json()).status, "linked");

  const deleteResp = await app.request("/admin/students/101", {
    method: "DELETE",
    headers: { "x-admin-key": "admin-key" }
  });
  assert.equal(deleteResp.status, 200);
});

test("admin student archive should return validation errors for duplicate/missing/abnormal studentNo", async () => {
  const app = new Hono();
  app.route(
    "/admin",
    createAdminRoutes({
      ...baseDependencies,
      adminStudentArchiveService: {
        async createStudentArchive() {
          return { studentId: 1 };
        },
        async getStudentArchive() {
          return { studentId: 1, studentNo: "S1", name: "张三", classId: 1 };
        },
        async updateStudentArchive() {
          return;
        },
        async deleteStudentArchive() {
          return;
        },
        async getEnrollmentLinkStatus() {
          return { status: "duplicate" as const, reason: "duplicate student_no in enrollment source" };
        }
      }
    })
  );

  const response = await app.request("/admin/students/1/enrollment-link", {
    headers: { "x-admin-key": "admin-key" }
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "duplicate");
  assert.ok(payload.reason.includes("duplicate"));
});
