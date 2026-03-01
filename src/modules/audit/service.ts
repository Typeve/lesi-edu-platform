export type AuditAction =
  | "authorization_grant"
  | "authorization_revoke"
  | "password_reset"
  | "activity_publish";

export interface PersistAuditLogInput {
  operator: string;
  action: AuditAction;
  target: string;
  detail: string | null;
  createdAt: Date;
}

export interface AuditLogRepository {
  createAuditLog(input: PersistAuditLogInput): Promise<void>;
}

export type AuthorizationGrantType = "student" | "class";
export type ActivityType = "course" | "competition" | "project";

export interface LogAuthorizationAuditInput {
  operator: string;
  teacherId: string;
  grantType: AuthorizationGrantType;
  targetId: number;
}

export interface LogPasswordResetAuditInput {
  operator: string;
  studentId: number;
}

export interface LogActivityPublishAuditInput {
  operator: string;
  activityType: ActivityType;
  activityTitle: string;
}

export interface AuditLogService {
  logAuthorizationGrant(input: LogAuthorizationAuditInput): Promise<void>;
  logAuthorizationRevoke(input: LogAuthorizationAuditInput): Promise<void>;
  logPasswordReset(input: LogPasswordResetAuditInput): Promise<void>;
  logActivityPublish(input: LogActivityPublishAuditInput): Promise<void>;
}

export interface CreateAuditLogServiceInput {
  auditLogRepo: AuditLogRepository;
}

const normalizeOperator = (operator: string): string => {
  const normalized = operator.trim();
  return normalized.length > 0 ? normalized : "system-admin";
};

const normalizeTitle = (activityTitle: string): string => {
  const normalized = activityTitle.trim();
  return normalized.length > 0 ? normalized : "untitled";
};

const createAuditTarget = (resourceType: string, identifier: string | number): string => {
  return `${resourceType}:${identifier}`;
};

export const createAuditLogService = ({ auditLogRepo }: CreateAuditLogServiceInput): AuditLogService => {
  return {
    async logAuthorizationGrant({ operator, teacherId, grantType, targetId }: LogAuthorizationAuditInput) {
      await auditLogRepo.createAuditLog({
        operator: normalizeOperator(operator),
        action: "authorization_grant",
        target: createAuditTarget(grantType, targetId),
        detail: `teacher:${teacherId}`,
        createdAt: new Date()
      });
    },

    async logAuthorizationRevoke({ operator, teacherId, grantType, targetId }: LogAuthorizationAuditInput) {
      await auditLogRepo.createAuditLog({
        operator: normalizeOperator(operator),
        action: "authorization_revoke",
        target: createAuditTarget(grantType, targetId),
        detail: `teacher:${teacherId}`,
        createdAt: new Date()
      });
    },

    async logPasswordReset({ operator, studentId }: LogPasswordResetAuditInput) {
      await auditLogRepo.createAuditLog({
        operator: normalizeOperator(operator),
        action: "password_reset",
        target: createAuditTarget("student", studentId),
        detail: null,
        createdAt: new Date()
      });
    },

    async logActivityPublish({ operator, activityType, activityTitle }: LogActivityPublishAuditInput) {
      await auditLogRepo.createAuditLog({
        operator: normalizeOperator(operator),
        action: "activity_publish",
        target: createAuditTarget(activityType, normalizeTitle(activityTitle)),
        detail: null,
        createdAt: new Date()
      });
    }
  };
};
