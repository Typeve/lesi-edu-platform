import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { db } from "./db/client.js";
import { students } from "./db/schema.js";
import { bcryptPasswordVerifier } from "./modules/auth/password.js";
import { createStudentAuthService } from "./modules/auth/service.js";
import { createJwtTokenSigner } from "./modules/auth/token.js";
import { createAuthRoutes } from "./routes/auth.js";
import healthRoutes from "./routes/health.js";

const studentAuthService = createStudentAuthService({
  studentRepo: {
    async findStudentByNo(studentNo) {
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
    }
  },
  passwordVerifier: bcryptPasswordVerifier,
  tokenSigner: createJwtTokenSigner({
    secret: env.JWT_SECRET,
    expiresInDays: env.JWT_EXPIRES_IN_DAYS
  })
});

const app = new Hono();

app.get("/", (c) =>
  c.json({
    service: "lesi-edu-platform-api",
    status: "running"
  })
);

app.route("/", healthRoutes);
app.route("/auth", createAuthRoutes({ studentAuthService }));

serve(
  {
    fetch: app.fetch,
    port: env.PORT
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
