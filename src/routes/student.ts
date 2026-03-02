import { Hono, type MiddlewareHandler } from "hono";
import {
  FileTooLargeError,
  InvalidFileTypeError,
  MissingUploadFileError,
  type CertificateUploadService,
  type UploadedFile
} from "../modules/upload/certificate-upload.js";
import {
  InvalidLikertAnswersError,
  type LikertAssessmentService
} from "../modules/assessment/likert.js";
import {
  LikertAssessmentResultNotFoundError,
  type LikertAssessmentResultService
} from "../modules/assessment/result.js";
import {
  RoleModelMatchingNotFoundError,
  type RoleModelDirection,
  type RoleModelMatchingService
} from "../modules/role-model/matching.js";

export interface StudentRouteDependencies {
  requireStudentAuth: MiddlewareHandler;
  certificateUploadService: CertificateUploadService;
  likertAssessmentService?: Pick<LikertAssessmentService, "getQuestions" | "submitAnswers">;
  likertAssessmentResultService?: Pick<LikertAssessmentResultService, "getResult">;
  roleModelMatchingService?: Pick<RoleModelMatchingService, "matchRoleModels">;
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
  certificateUploadService,
  likertAssessmentService = {
    async getQuestions() {
      throw new Error("likertAssessmentService is not configured");
    },
    async submitAnswers() {
      throw new Error("likertAssessmentService is not configured");
    }
  },
  likertAssessmentResultService = {
    async getResult() {
      throw new Error("likertAssessmentResultService is not configured");
    }
  },
  roleModelMatchingService = {
    async matchRoleModels() {
      throw new Error("roleModelMatchingService is not configured");
    }
  }
}: StudentRouteDependencies) => {
  const student = new Hono();

  student.get("/assessments/questions", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const result = await likertAssessmentService.getQuestions();
    return c.json(result, 200);
  });

  student.post("/assessments/submissions", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "invalid request body" }, 400);
    }

    const answers = (body as { answers?: unknown })?.answers;
    if (!Array.isArray(answers)) {
      return c.json({ message: "answers must include exactly 50 likert items" }, 400);
    }

    try {
      const result = await likertAssessmentService.submitAnswers({
        studentId: studentAuth.studentId,
        answers: answers as Array<{ questionId: number; score: number }>
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof InvalidLikertAnswersError) {
        return c.json({ message: error.message }, 400);
      }

      throw error;
    }
  });

  student.get("/assessments/result", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    try {
      const result = await likertAssessmentResultService.getResult({
        studentId: studentAuth.studentId
      });
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof LikertAssessmentResultNotFoundError) {
        return c.json({ message: "assessment submission not found" }, 404);
      }

      throw error;
    }
  });

  student.get("/role-models/match", requireStudentAuth, async (c) => {
    const studentAuth = c.get("studentAuth");
    if (!studentAuth) {
      return c.json({ message: "unauthorized" }, 401);
    }

    const directionInput = c.req.query("direction");
    const direction: RoleModelDirection =
      directionInput === "postgraduate" || directionInput === "civil_service"
        ? directionInput
        : "employment";

    try {
      const result = await roleModelMatchingService.matchRoleModels({
        studentNo: studentAuth.studentNo,
        direction
      });

      return c.json(result, 200);
    } catch (error) {
      if (error instanceof RoleModelMatchingNotFoundError) {
        return c.json({ message: "student enrollment profile not found" }, 404);
      }

      throw error;
    }
  });

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
