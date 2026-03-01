import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as {
  sign(payload: Record<string, unknown>, secret: string, options: { expiresIn: number }): string;
};

const SECONDS_PER_DAY = 24 * 60 * 60;

export interface StudentTokenPayload {
  studentId: number;
  studentNo: string;
}

export interface StudentTokenSigner {
  expiresIn: number;
  signStudentToken(payload: StudentTokenPayload): string;
}

export interface CreateJwtTokenSignerInput {
  secret: string;
  expiresInDays: number;
}

export const createJwtTokenSigner = ({
  secret,
  expiresInDays
}: CreateJwtTokenSignerInput): StudentTokenSigner => {
  const expiresIn = expiresInDays * SECONDS_PER_DAY;

  return {
    expiresIn,
    signStudentToken(payload) {
      return jwt.sign(
        {
          sub: String(payload.studentId),
          role: "student",
          studentNo: payload.studentNo
        },
        secret,
        { expiresIn }
      );
    }
  };
};
