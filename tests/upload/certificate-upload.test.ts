import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { File } from "node:buffer";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createCertificateUploadService,
  FileTooLargeError,
  InvalidFileTypeError,
  type CertificateFileRepository
} from "../../src/modules/upload/certificate-upload.ts";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const authorizedStudentMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header("authorization") ?? "";

  if (authorization !== "Bearer valid-token") {
    return c.json({ message: "unauthorized" }, 401);
  }

  c.set("studentAuth", {
    studentId: 1001,
    studentNo: "S20261001",
    mustChangePassword: false
  });

  await next();
};

interface UploadFixture {
  records: Array<{
    fileId: string;
    studentId: number;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    createdAt: Date;
  }>;
}

const createCertificateFileRepo = (fixture: UploadFixture): CertificateFileRepository => ({
  async createCertificateFile(input) {
    fixture.records.push(input);
  }
});

const createTestApp = async () => {
  const fixture: UploadFixture = {
    records: []
  };

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "b05-upload-"));

  const uploadService = createCertificateUploadService({
    certificateFileRepo: createCertificateFileRepo(fixture),
    uploadDir,
    maxSizeBytes: MAX_SIZE_BYTES
  });

  const app = new Hono();
  app.route(
    "/student",
    createStudentRoutes({
      requireStudentAuth: authorizedStudentMiddleware,
      certificateUploadService: uploadService
    })
  );

  return { app, fixture, uploadDir };
};

test("certificate upload should return 401 when authorization is missing", async () => {
  const { app, uploadDir } = await createTestApp();

  const formData = new FormData();
  formData.append("file", new File([Buffer.from("ok")], "proof.jpg", { type: "image/jpeg" }));

  const response = await app.request("/student/certificates/upload", {
    method: "POST",
    body: formData
  });

  assert.equal(response.status, 401);

  await fs.rm(uploadDir, { recursive: true, force: true });
});

test("certificate upload should return 400 when file field is missing", async () => {
  const { app, uploadDir } = await createTestApp();

  const formData = new FormData();

  const response = await app.request("/student/certificates/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token"
    },
    body: formData
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "file is required" });

  await fs.rm(uploadDir, { recursive: true, force: true });
});

test("certificate upload should reject unsupported file type with 415", async () => {
  const { app, uploadDir } = await createTestApp();

  const formData = new FormData();
  formData.append(
    "file",
    new File([Buffer.from("hello")], "malware.exe", { type: "application/octet-stream" })
  );

  const response = await app.request("/student/certificates/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token"
    },
    body: formData
  });

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), { message: "unsupported file type" });

  await fs.rm(uploadDir, { recursive: true, force: true });
});

test("certificate upload should reject oversized file with 413", async () => {
  const { app, uploadDir } = await createTestApp();

  const overLimit = Buffer.alloc(MAX_SIZE_BYTES + 1, 1);
  const formData = new FormData();
  formData.append("file", new File([overLimit], "large.pdf", { type: "application/pdf" }));

  const response = await app.request("/student/certificates/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token"
    },
    body: formData
  });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    message: "file too large"
  });

  await fs.rm(uploadDir, { recursive: true, force: true });
});

test("certificate upload should return trackable fileId on success", async () => {
  const { app, fixture, uploadDir } = await createTestApp();

  const formData = new FormData();
  formData.append("file", new File([Buffer.from("content")], "proof.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }));

  const response = await app.request("/student/certificates/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token"
    },
    body: formData
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { fileId: string };

  assert.ok(body.fileId.startsWith("cert_"));
  assert.equal(fixture.records.length, 1);
  assert.equal(fixture.records[0].studentId, 1001);

  const storedPath = fixture.records[0].storagePath;
  const stat = await fs.stat(storedPath);
  assert.ok(stat.isFile());

  await fs.rm(uploadDir, { recursive: true, force: true });
});

// keep imports referenced for explicit behavior assertion
void FileTooLargeError;
void InvalidFileTypeError;
