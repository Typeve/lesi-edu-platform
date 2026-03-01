import { Hono, type MiddlewareHandler } from "hono";
import {
  FileTooLargeError,
  InvalidFileTypeError,
  MissingUploadFileError,
  type CertificateUploadService,
  type UploadedFile
} from "../modules/upload/certificate-upload.js";

export interface StudentRouteDependencies {
  requireStudentAuth: MiddlewareHandler;
  certificateUploadService: CertificateUploadService;
}

const isUploadedFile = (value: unknown): value is UploadedFile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    name?: unknown;
    type?: unknown;
    size?: unknown;
    arrayBuffer?: unknown;
  };

  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function"
  );
};

const resolveFileFromBody = (body: Record<string, unknown>): UploadedFile | null => {
  const fileField = body.file;

  if (Array.isArray(fileField)) {
    return null;
  }

  return isUploadedFile(fileField) ? fileField : null;
};

export const createStudentRoutes = ({
  requireStudentAuth,
  certificateUploadService
}: StudentRouteDependencies) => {
  const student = new Hono();

  student.post("/certificates/upload", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    const file = resolveFileFromBody(body);

    try {
      const result = await certificateUploadService.uploadCertificate({
        studentId: studentAuth.studentId,
        file: file ?? undefined
      });

      return c.json({ fileId: result.fileId }, 200);
    } catch (error) {
      if (error instanceof MissingUploadFileError) {
        return c.json({ message: "file is required" }, 400);
      }

      if (error instanceof InvalidFileTypeError) {
        return c.json({ message: "unsupported file type" }, 415);
      }

      if (error instanceof FileTooLargeError) {
        return c.json({ message: "file too large" }, 413);
      }

      throw error;
    }
  });

  return student;
};

export default createStudentRoutes;
