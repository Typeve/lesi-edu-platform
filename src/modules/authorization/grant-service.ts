export type GrantType = "student" | "class";

export interface AuthorizationGrantInput {
  grantType: GrantType;
  teacherId: string;
  targetId: number;
}

export interface AuthorizationGrantRepository {
  assignStudentGrant(teacherId: string, studentId: number): Promise<void>;
  revokeStudentGrant(teacherId: string, studentId: number): Promise<void>;
  assignClassGrant(teacherId: string, classId: number): Promise<void>;
  revokeClassGrant(teacherId: string, classId: number): Promise<void>;
}

export interface AuthorizationGrantService {
  assignGrant(input: AuthorizationGrantInput): Promise<void>;
  revokeGrant(input: AuthorizationGrantInput): Promise<void>;
}

export interface CreateAuthorizationGrantServiceInput {
  authorizationGrantRepo: AuthorizationGrantRepository;
}

export const createAuthorizationGrantService = ({
  authorizationGrantRepo
}: CreateAuthorizationGrantServiceInput): AuthorizationGrantService => {
  return {
    async assignGrant({ grantType, teacherId, targetId }: AuthorizationGrantInput): Promise<void> {
      if (grantType === "student") {
        await authorizationGrantRepo.assignStudentGrant(teacherId, targetId);
        return;
      }

      await authorizationGrantRepo.assignClassGrant(teacherId, targetId);
    },

    async revokeGrant({ grantType, teacherId, targetId }: AuthorizationGrantInput): Promise<void> {
      if (grantType === "student") {
        await authorizationGrantRepo.revokeStudentGrant(teacherId, targetId);
        return;
      }

      await authorizationGrantRepo.revokeClassGrant(teacherId, targetId);
    }
  };
};
