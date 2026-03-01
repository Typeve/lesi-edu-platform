import type { PasswordVerifier } from "./password.js";
import type { StudentTokenSigner } from "./token.js";

export interface StudentAuthRecord {
  id: number;
  studentNo: string;
  passwordHash: string | null;
  mustChangePassword: boolean;
}

export interface StudentAuthRepository {
  findStudentByNo(studentNo: string): Promise<StudentAuthRecord | null>;
}

export interface StudentLoginInput {
  studentNo: string;
  password: string;
}

export interface StudentLoginResult {
  token: string;
  expiresIn: number;
  mustChangePassword: boolean;
}

export class StudentLoginUnauthorizedError extends Error {
  constructor() {
    super("invalid studentNo or password");
    this.name = "StudentLoginUnauthorizedError";
  }
}

export interface CreateStudentAuthServiceInput {
  studentRepo: StudentAuthRepository;
  passwordVerifier: PasswordVerifier;
  tokenSigner: StudentTokenSigner;
}

const isNonEmptyHash = (passwordHash: string | null): passwordHash is string => {
  return typeof passwordHash === "string" && passwordHash.trim().length > 0;
};

export const createStudentAuthService = ({
  studentRepo,
  passwordVerifier,
  tokenSigner
}: CreateStudentAuthServiceInput) => {
  return {
    async loginStudent({ studentNo, password }: StudentLoginInput): Promise<StudentLoginResult> {
      const student = await studentRepo.findStudentByNo(studentNo);

      if (!student || !isNonEmptyHash(student.passwordHash)) {
        throw new StudentLoginUnauthorizedError();
      }

      const passwordMatched = await passwordVerifier.compare(password, student.passwordHash);
      if (!passwordMatched) {
        throw new StudentLoginUnauthorizedError();
      }

      return {
        token: tokenSigner.signStudentToken({
          studentId: student.id,
          studentNo: student.studentNo
        }),
        expiresIn: tokenSigner.expiresIn,
        mustChangePassword: student.mustChangePassword
      };
    }
  };
};
