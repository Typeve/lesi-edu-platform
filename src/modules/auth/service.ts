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

export interface StudentAuthService {
  loginStudent(input: StudentLoginInput): Promise<StudentLoginResult>;
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

const DUMMY_PASSWORD_HASH = "$2b$10$ykqJ8CfeprKl2UpQm9a7ZOv9wZWyG2J.AoPTB5oTvbGdZyc/Ljcsm";

const isNonEmptyHash = (passwordHash: string | null): passwordHash is string => {
  return typeof passwordHash === "string" && passwordHash.trim().length > 0;
};

export const createStudentAuthService = ({
  studentRepo,
  passwordVerifier,
  tokenSigner
}: CreateStudentAuthServiceInput): StudentAuthService => {
  return {
    async loginStudent({ studentNo, password }: StudentLoginInput): Promise<StudentLoginResult> {
      const student = await studentRepo.findStudentByNo(studentNo);

      let hasUsableHash = false;
      let passwordHashForCompare = DUMMY_PASSWORD_HASH;

      if (student && isNonEmptyHash(student.passwordHash)) {
        hasUsableHash = true;
        passwordHashForCompare = student.passwordHash;
      }

      const passwordMatched = await passwordVerifier.compare(password, passwordHashForCompare);

      if (!student || !hasUsableHash || !passwordMatched) {
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
