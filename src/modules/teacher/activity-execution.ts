export interface TeacherActivityExecutionRepository {
  isTeacherAssigned(teacherId: string, activityId: number): Promise<boolean>;
  upsertExecutionRecord(input: {
    teacherId: string;
    activityId: number;
    payloadJson: string;
    updatedAt: Date;
  }): Promise<number>;
}

export interface TeacherActivityExecutionService {
  executeActivity(input: {
    teacherId: string;
    activityId: number;
    payload: unknown;
  }): Promise<{
    recordId: number;
    status: "submitted";
  }>;
}

export interface CreateTeacherActivityExecutionServiceInput {
  teacherActivityExecutionRepo: TeacherActivityExecutionRepository;
}

export class TeacherActivityForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "TeacherActivityForbiddenError";
  }
}

export const createTeacherActivityExecutionService = ({
  teacherActivityExecutionRepo
}: CreateTeacherActivityExecutionServiceInput): TeacherActivityExecutionService => {
  return {
    async executeActivity({ teacherId, activityId, payload }) {
      const assigned = await teacherActivityExecutionRepo.isTeacherAssigned(teacherId, activityId);
      if (!assigned) {
        throw new TeacherActivityForbiddenError();
      }

      const recordId = await teacherActivityExecutionRepo.upsertExecutionRecord({
        teacherId,
        activityId,
        payloadJson: JSON.stringify(payload ?? {}),
        updatedAt: new Date()
      });

      return {
        recordId,
        status: "submitted"
      };
    }
  };
};
