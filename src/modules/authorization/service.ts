export type ResourceType = "report" | "task" | "certificate" | "profile";

export interface AuthorizationRepository {
  findResourceStudentId(resourceType: ResourceType, resourceId: number): Promise<number | null>;
  hasTeacherStudentGrant(teacherId: string, studentId: number): Promise<boolean>;
  findStudentClassId(studentId: number): Promise<number | null>;
  hasTeacherClassGrant(teacherId: string, classId: number): Promise<boolean>;
}

export interface AuthorizeTeacherResourceInput {
  teacherId: string;
  resourceType: ResourceType;
  resourceId: number;
}

export type ResourceAuthorizationDecision =
  | { status: "allowed"; studentId: number }
  | { status: "not_found" }
  | { status: "forbidden"; studentId: number };

export interface ResourceAuthorizationService {
  findResourceStudentId(
    input: Pick<AuthorizeTeacherResourceInput, "resourceType" | "resourceId">
  ): Promise<number | null>;
  authorizeTeacherResource(
    input: AuthorizeTeacherResourceInput
  ): Promise<ResourceAuthorizationDecision>;
}

export interface CreateResourceAuthorizationServiceInput {
  authorizationRepo: AuthorizationRepository;
}

export const createResourceAuthorizationService = ({
  authorizationRepo
}: CreateResourceAuthorizationServiceInput): ResourceAuthorizationService => {
  return {
    async findResourceStudentId({ resourceType, resourceId }) {
      return authorizationRepo.findResourceStudentId(resourceType, resourceId);
    },
    async authorizeTeacherResource({
      teacherId,
      resourceType,
      resourceId
    }: AuthorizeTeacherResourceInput): Promise<ResourceAuthorizationDecision> {
      const studentId = await authorizationRepo.findResourceStudentId(resourceType, resourceId);

      if (!studentId) {
        return { status: "not_found" };
      }

      const hasStudentGrant = await authorizationRepo.hasTeacherStudentGrant(teacherId, studentId);
      if (hasStudentGrant) {
        return { status: "allowed", studentId };
      }

      const classId = await authorizationRepo.findStudentClassId(studentId);
      if (!classId) {
        return { status: "forbidden", studentId };
      }

      const hasClassGrant = await authorizationRepo.hasTeacherClassGrant(teacherId, classId);
      if (hasClassGrant) {
        return { status: "allowed", studentId };
      }

      return { status: "forbidden", studentId };
    }
  };
};
