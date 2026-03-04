import type { AuthRole } from "../auth/session-token.js";

export const ROLE_PERMISSIONS: Record<AuthRole, string[]> = {
  student: [
    "student.profile.read",
    "student.assessment.submit",
    "report.read",
    "task.read",
    "task.checkin.submit",
    "certificate.upload"
  ],
  teacher: [
    "teacher.students.read",
    "teacher.student.detail.read",
    "teacher.activity.execute",
    "report.read",
    "task.read",
    "student.profile.read"
  ],
  admin: [
    "admin.org.manage",
    "admin.teacher.manage",
    "admin.authorization.manage",
    "admin.activity.publish",
    "admin.dashboard.read"
  ]
};

export const hasPermissionByRole = ({
  role,
  permission
}: {
  role: AuthRole;
  permission: string;
}): boolean => {
  const granted = ROLE_PERMISSIONS[role] ?? [];
  return granted.includes(permission);
};
