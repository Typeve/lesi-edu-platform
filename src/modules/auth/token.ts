import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken") as {
  sign(payload: Record<string, unknown>, secret: string, options: { expiresIn: number }): string;
  verify(token: string, secret: string): string | Record<string, unknown>;
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

export interface VerifiedStudentTokenPayload {
  studentId: number;
  studentNo: string;
}

export interface StudentTokenVerifier {
  verifyStudentToken(token: string): VerifiedStudentTokenPayload | null;
}

export interface CreateJwtTokenVerifierInput {
  secret: string;
}

const toVerifiedStudentTokenPayload = (
  payload: string | Record<string, unknown>
): VerifiedStudentTokenPayload | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const role = payload.role;
  const sub = payload.sub;
  const studentNo = payload.studentNo;

  if (role !== "student" || typeof sub !== "string" || typeof studentNo !== "string") {
    return null;
  }

  const studentId = Number(sub);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return null;
  }

  return {
    studentId,
    studentNo
  };
};

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

export const createJwtTokenVerifier = ({
  secret
}: CreateJwtTokenVerifierInput): StudentTokenVerifier => {
  return {
    verifyStudentToken(token) {
      try {
        const decoded = jwt.verify(token, secret);
        return toVerifiedStudentTokenPayload(decoded);
      } catch {
        return null;
      }
    }
  };
};
