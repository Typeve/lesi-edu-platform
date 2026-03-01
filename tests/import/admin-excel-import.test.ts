import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { File } from "node:buffer";
import { createAdminRoutes } from "../../src/routes/admin.ts";
import {
  MissingImportFileError,
  UnsupportedExcelFileTypeError,
  type ExcelImportValidationService
} from "../../src/modules/import/excel-validation.ts";

const adminApiKey = "admin-secret-key";

interface Fixture {
  calls: Array<{ datasetType: "enrollment" | "employment" }>;
}

const createNoopAdminApp = (
  fixture: Fixture,
  excelImportValidationService: Pick<ExcelImportValidationService, "validateExcelImport">
) => {
  const app = new Hono();

  app.route(
    "/admin",
    createAdminRoutes({
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
          return;
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
      excelImportValidationService,
      adminApiKey
    })
  );

  return app;
};

test("admin excel import validate should return 403 when admin key is missing", async () => {
  const fixture: Fixture = { calls: [] };

  const app = createNoopAdminApp(fixture, {
    async validateExcelImport() {
      fixture.calls.push({ datasetType: "enrollment" });
      return { total: 0, success: 0, failed: 0, errors: [] };
    }
  });

  const formData = new FormData();
  formData.append(
    "file",
    new File([Buffer.from("dummy")], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
  formData.append("datasetType", "enrollment");

  const response = await app.request("/admin/imports/excel/validate", {
    method: "POST",
    body: formData
  });

  assert.equal(response.status, 403);
  assert.equal(fixture.calls.length, 0);
});

test("admin excel import validate should return 400 when datasetType is invalid", async () => {
  const fixture: Fixture = { calls: [] };

  const app = createNoopAdminApp(fixture, {
    async validateExcelImport() {
      fixture.calls.push({ datasetType: "enrollment" });
      return { total: 0, success: 0, failed: 0, errors: [] };
    }
  });

  const formData = new FormData();
  formData.append(
    "file",
    new File([Buffer.from("dummy")], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
  formData.append("datasetType", "unknown");

  const response = await app.request("/admin/imports/excel/validate", {
    method: "POST",
    headers: {
      "X-Admin-Key": adminApiKey
    },
    body: formData
  });

  assert.equal(response.status, 400);
  assert.equal(fixture.calls.length, 0);
});

test("admin excel import validate should return 415 when file type is unsupported", async () => {
  const fixture: Fixture = { calls: [] };

  const app = createNoopAdminApp(fixture, {
    async validateExcelImport() {
      throw new UnsupportedExcelFileTypeError();
    }
  });

  const formData = new FormData();
  formData.append("file", new File([Buffer.from("dummy")], "demo.csv", { type: "text/csv" }));
  formData.append("datasetType", "employment");

  const response = await app.request("/admin/imports/excel/validate", {
    method: "POST",
    headers: {
      "X-Admin-Key": adminApiKey
    },
    body: formData
  });

  assert.equal(response.status, 415);
  assert.equal(fixture.calls.length, 0);
});

test("admin excel import validate should return validation summary", async () => {
  const fixture: Fixture = { calls: [] };

  const app = createNoopAdminApp(fixture, {
    async validateExcelImport(input) {
      fixture.calls.push({ datasetType: input.datasetType });
      return {
        total: 10,
        success: 7,
        failed: 3,
        errors: [{ row: 3, field: "studentNo", reason: "duplicate studentNo" }]
      };
    }
  });

  const formData = new FormData();
  formData.append(
    "file",
    new File([Buffer.from("dummy")], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
  formData.append("datasetType", "employment");

  const response = await app.request("/admin/imports/excel/validate", {
    method: "POST",
    headers: {
      "X-Admin-Key": adminApiKey
    },
    body: formData
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    total: 10,
    success: 7,
    failed: 3,
    errors: [{ row: 3, field: "studentNo", reason: "duplicate studentNo" }]
  });

  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].datasetType, "employment");
});

test("admin excel import validate should return 400 when file is missing", async () => {
  const fixture: Fixture = { calls: [] };

  const app = createNoopAdminApp(fixture, {
    async validateExcelImport() {
      throw new MissingImportFileError();
    }
  });

  const formData = new FormData();
  formData.append("datasetType", "enrollment");

  const response = await app.request("/admin/imports/excel/validate", {
    method: "POST",
    headers: {
      "X-Admin-Key": adminApiKey
    },
    body: formData
  });

  assert.equal(response.status, 400);
});
