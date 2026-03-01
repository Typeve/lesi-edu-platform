import type { PasswordHasher, PasswordVerifier } from "./password.js";
import type { StudentTokenSigner } from "./token.js";

export interface StudentAuthRecord {
  id: number;
  studentNo: string;
  passwordHash: string | null;
  mustChangePassword: boolean;
}

export interface StudentPasswordUpdateInput {
  studentId: number;
  passwordHash: string;
  passwordUpdatedAt: Date;
  mustChangePassword: boolean;
}

export interface StudentAuthRepository {
  findStudentByNo(studentNo: string): Promise<StudentAuthRecord | null>;
  findStudentById(studentId: number): Promise<StudentAuthRecord | null>;
  updateStudentPassword(input: StudentPasswordUpdateInput): Promise<void>;
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

export interface StudentChangePasswordInput {
  studentId: number;
  oldPassword: string;
  newPassword: string;
}

export interface StudentAuthService {
  loginStudent(input: StudentLoginInput): Promise<StudentLoginResult>;
  changeStudentPassword(input: StudentChangePasswordInput): Promise<void>;
}

export class StudentLoginUnauthorizedError extends Error {
  constructor() {
    super("invalid studentNo or password");
    this.name = "StudentLoginUnauthorizedError";
  }
}

export class StudentChangePasswordUnauthorizedError extends Error {
  constructor() {
    super("invalid old password");
    this.name = "StudentChangePasswordUnauthorizedError";
  }
}

export interface CreateStudentAuthServiceInput {
  studentRepo: StudentAuthRepository;
  passwordVerifier: PasswordVerifier;
  passwordHasher?: PasswordHasher;
  tokenSigner: StudentTokenSigner;
}

const DUMMY_PASSWORD_HASH = "$2b$10$ykqJ8CfeprKl2UpQm9a7ZOv9wZWyG2J.AoPTB5oTvbGdZyc/Ljcsm";

const isNonEmptyHash = (passwordHash: string | null): passwordHash is string => {
  return typeof passwordHash === "string" && passwordHash.trim().length > 0;
};

const defaultPasswordHasher: PasswordHasher = {
  async hash() {
    throw new Error("passwordHasher is not configured");
  }
};

export const createStudentAuthService = ({
  studentRepo,
  passwordVerifier,
  passwordHasher = defaultPasswordHasher,
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
    },
    async changeStudentPassword({ studentId, oldPassword, newPassword }: StudentChangePasswordInput): Promise<void> {
      const student = await studentRepo.findStudentById(studentId);

      let hasUsableHash = false;
      let passwordHashForCompare = DUMMY_PASSWORD_HASH;

      if (student && isNonEmptyHash(student.passwordHash)) {
        hasUsableHash = true;
        passwordHashForCompare = student.passwordHash;
      }

      const oldPasswordMatched = await passwordVerifier.compare(oldPassword, passwordHashForCompare);

      if (!student || !hasUsableHash || !oldPasswordMatched) {
        throw new StudentChangePasswordUnauthorizedError();
      }

      const nextPasswordHash = await passwordHasher.hash(newPassword);

      await studentRepo.updateStudentPassword({
        studentId,
        passwordHash: nextPasswordHash,
        passwordUpdatedAt: new Date(),
        mustChangePassword: false
      });
    }
  };
};
