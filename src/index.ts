import { serve } from "@hono/node-server";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { db } from "./db/client.js";
import {
  certificates,
  profiles,
  reports,
  students,
  tasks,
  teacherClassGrants,
  teacherStudentGrants
} from "./db/schema.js";
import { createStudentAuthMiddleware } from "./middleware/auth.js";
import { createResourceAuthorizationMiddleware } from "./middleware/resource-authorization.js";
import { createResourceAuthorizationService, type ResourceType } from "./modules/authorization/service.js";
import { bcryptPasswordHasher, bcryptPasswordVerifier } from "./modules/auth/password.js";
import { createStudentAuthService } from "./modules/auth/service.js";
import { createJwtTokenSigner, createJwtTokenVerifier } from "./modules/auth/token.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAuthRoutes } from "./routes/auth.js";
import healthRoutes from "./routes/health.js";
import { createResourcesRoutes } from "./routes/resources.js";

const studentRepo = {
  async findStudentByNo(studentNo: string) {
    const records = await db
      .select({
        id: students.id,
        studentNo: students.studentNo,
        passwordHash: students.passwordHash,
        mustChangePassword: students.mustChangePassword
      })
      .from(students)
      .where(eq(students.studentNo, studentNo))
      .limit(1);

    return records[0] ?? null;
  },
  async findStudentById(studentId: number) {
    const records = await db
      .select({
        id: students.id,
        studentNo: students.studentNo,
        passwordHash: students.passwordHash,
        mustChangePassword: students.mustChangePassword
      })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    return records[0] ?? null;
  },
  async updateStudentPassword({ studentId, passwordHash, passwordUpdatedAt, mustChangePassword }: {
    studentId: number;
    passwordHash: string;
    passwordUpdatedAt: Date;
    mustChangePassword: boolean;
  }) {
    await db
      .update(students)
      .set({
        passwordHash,
        passwordUpdatedAt,
        mustChangePassword
      })
      .where(eq(students.id, studentId));
  }
};

const studentAuthService = createStudentAuthService({
  studentRepo,
  passwordVerifier: bcryptPasswordVerifier,
  passwordHasher: bcryptPasswordHasher,
  tokenSigner: createJwtTokenSigner({
    secret: env.JWT_SECRET,
    expiresInDays: env.JWT_EXPIRES_IN_DAYS
  })
});

const requireStudentAuth = createStudentAuthMiddleware({
  tokenVerifier: createJwtTokenVerifier({
    secret: env.JWT_SECRET
  }),
  studentRepo
});

const authorizationRepo = {
  async findResourceStudentId(resourceType: ResourceType, resourceId: number): Promise<number | null> {
    switch (resourceType) {
      case "report": {
        const records = await db
          .select({ studentId: reports.studentId })
          .from(reports)
          .where(eq(reports.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      case "task": {
        const records = await db
          .select({ studentId: tasks.studentId })
          .from(tasks)
          .where(eq(tasks.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      case "certificate": {
        const records = await db
          .select({ studentId: certificates.studentId })
          .from(certificates)
          .where(eq(certificates.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      case "profile": {
        const records = await db
          .select({ studentId: profiles.studentId })
          .from(profiles)
          .where(eq(profiles.id, resourceId))
          .limit(1);
        return records[0]?.studentId ?? null;
      }
      default:
        return null;
    }
  },
  async hasTeacherStudentGrant(teacherId: string, studentId: number): Promise<boolean> {
    const records = await db
      .select({ id: teacherStudentGrants.id })
      .from(teacherStudentGrants)
      .where(
        and(
          eq(teacherStudentGrants.teacherId, teacherId),
          eq(teacherStudentGrants.studentId, studentId)
        )
      )
      .limit(1);

    return records.length > 0;
  },
  async findStudentClassId(studentId: number): Promise<number | null> {
    const records = await db
      .select({ classId: students.classId })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    return records[0]?.classId ?? null;
  },
  async hasTeacherClassGrant(teacherId: string, classId: number): Promise<boolean> {
    const records = await db
      .select({ id: teacherClassGrants.id })
      .from(teacherClassGrants)
      .where(and(eq(teacherClassGrants.teacherId, teacherId), eq(teacherClassGrants.classId, classId)))
      .limit(1);

    return records.length > 0;
  }
};

const resourceAuthorizationService = createResourceAuthorizationService({
  authorizationRepo
});

const createResourceAuthorization = (resourceType: ResourceType) =>
  createResourceAuthorizationMiddleware({
    resourceType,
    authorizationService: resourceAuthorizationService
  });

const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "lesi-edu-platform-api",
    status: "running"
  })
);

app.route("/", healthRoutes);
app.route("/auth", createAuthRoutes({ studentAuthService, requireStudentAuth }));
app.route(
  "/admin",
  createAdminRoutes({
    studentAuthService,
    adminApiKey: env.ADMIN_API_KEY
  })
);
app.route("/resources", createResourcesRoutes({ createResourceAuthorization }));

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
