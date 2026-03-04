import type { PasswordHasher, PasswordVerifier } from "./password.js";
import type { AuthRole, AuthTokenSigner } from "./session-token.js";

export interface UnifiedAuthAccountRecord {
  role: Exclude<AuthRole, "admin">;
  subjectId: string;
  account: string;
  displayName: string;
  passwordHash: string | null;
  status: "active" | "frozen";
  mustChangePassword: boolean;
  scope: {
    schoolId?: number;
    collegeId?: number;
    majorId?: number;
    classId?: number;
  };
  studentId?: number;
  studentNo?: string;
  teacherId?: string;
}

export interface UnifiedAuthRepository {
  findByRoleAndAccount(role: Exclude<AuthRole, "admin">, account: string): Promise<UnifiedAuthAccountRecord | null>;
  findByRoleAndSubjectId(role: Exclude<AuthRole, "admin">, subjectId: string): Promise<UnifiedAuthAccountRecord | null>;
  updatePassword(input: {
    role: Exclude<AuthRole, "admin">;
    subjectId: string;
    passwordHash: string;
    mustChangePassword: boolean;
  }): Promise<void>;
}

export interface UnifiedLoginInput {
  role: AuthRole;
  account: string;
  password: string;
}

export interface UnifiedLoginResult {
  token: string;
  tokenType: "Bearer";
  expiresIn: number;
  role: AuthRole;
  mustChangePassword: boolean;
  displayName: string;
}

export interface UnifiedChangePasswordInput {
  role: AuthRole;
  subjectId: string;
  oldPassword: string;
  newPassword: string;
}

export interface UnifiedAuthService {
  login(input: UnifiedLoginInput): Promise<UnifiedLoginResult>;
  changePassword(input: UnifiedChangePasswordInput): Promise<void>;
}

export class UnifiedAuthUnauthorizedError extends Error {
  constructor() {
    super("invalid account or password");
    this.name = "UnifiedAuthUnauthorizedError";
  }
}

export class UnifiedAuthFrozenError extends Error {
  constructor() {
    super("account is frozen");
    this.name = "UnifiedAuthFrozenError";
  }
}

export class UnifiedAuthUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnifiedAuthUnsupportedError";
  }
}

export class UnifiedAuthInvalidNewPasswordError extends Error {
  constructor() {
    super("newPassword is required and must be at least 8 characters");
    this.name = "UnifiedAuthInvalidNewPasswordError";
  }
}

export interface CreateUnifiedAuthServiceInput {
  authRepo: UnifiedAuthRepository;
  passwordVerifier: PasswordVerifier;
  passwordHasher: PasswordHasher;
  tokenSigner: AuthTokenSigner;
  adminAccount: {
    account: string;
    password: string;
  };
}

const DUMMY_PASSWORD_HASH = "$2b$10$ykqJ8CfeprKl2UpQm9a7ZOv9wZWyG2J.AoPTB5oTvbGdZyc/Ljcsm";

const ensureValidNewPassword = (newPassword: string): void => {
  if (newPassword.trim().length < 8) {
    throw new UnifiedAuthInvalidNewPasswordError();
  }
};

export const createUnifiedAuthService = ({
  authRepo,
  passwordVerifier,
  passwordHasher,
  tokenSigner,
  adminAccount
}: CreateUnifiedAuthServiceInput): UnifiedAuthService => {
  return {
    async login({ role, account, password }) {
      const normalizedAccount = account.trim();

      if (role === "admin") {
        if (normalizedAccount !== adminAccount.account || password !== adminAccount.password) {
          throw new UnifiedAuthUnauthorizedError();
        }

        return {
          token: tokenSigner.signAuthToken({
            sub: "admin",
            role: "admin",
            account: adminAccount.account,
            displayName: "管理员",
            schoolId: 1
          }),
          tokenType: "Bearer",
          expiresIn: tokenSigner.expiresIn,
          role: "admin",
          mustChangePassword: false,
          displayName: "管理员"
        };
      }

      const record = await authRepo.findByRoleAndAccount(role, normalizedAccount);
      const passwordHashForCompare = typeof record?.passwordHash === "string" ? record.passwordHash : DUMMY_PASSWORD_HASH;
      const passwordMatched = await passwordVerifier.compare(password, passwordHashForCompare);

      if (!record || !record.passwordHash || !passwordMatched) {
        throw new UnifiedAuthUnauthorizedError();
      }

      if (record.status !== "active") {
        throw new UnifiedAuthFrozenError();
      }

      return {
        token: tokenSigner.signAuthToken({
          sub: record.subjectId,
          role,
          account: record.account,
          displayName: record.displayName,
          studentId: record.studentId,
          studentNo: record.studentNo,
          teacherId: record.teacherId,
          schoolId: record.scope.schoolId,
          collegeId: record.scope.collegeId,
          majorId: record.scope.majorId,
          classId: record.scope.classId,
          mustChangePassword: record.mustChangePassword
        }),
        tokenType: "Bearer",
        expiresIn: tokenSigner.expiresIn,
        role,
        mustChangePassword: record.mustChangePassword,
        displayName: record.displayName
      };
    },

    async changePassword({ role, subjectId, oldPassword, newPassword }) {
      if (role === "admin") {
        throw new UnifiedAuthUnsupportedError("admin password is managed by system");
      }

      const record = await authRepo.findByRoleAndSubjectId(role, subjectId);
      const passwordHashForCompare = typeof record?.passwordHash === "string" ? record.passwordHash : DUMMY_PASSWORD_HASH;
      const oldPasswordMatched = await passwordVerifier.compare(oldPassword, passwordHashForCompare);

      if (!record || !record.passwordHash || !oldPasswordMatched) {
        throw new UnifiedAuthUnauthorizedError();
      }

      if (record.status !== "active") {
        throw new UnifiedAuthFrozenError();
      }

      ensureValidNewPassword(newPassword);

      const passwordHash = await passwordHasher.hash(newPassword);
      await authRepo.updatePassword({
        role,
        subjectId,
        passwordHash,
        mustChangePassword: false
      });
    }
  };
};
