export interface TaskCheckInRepository {
  findTaskByIdAndStudentId(taskId: number, studentId: number): Promise<{ id: number; studentId: number } | null>;
  hasCertificateFileForStudent(studentId: number, fileId: string): Promise<boolean>;
  upsertTaskCheckIn(input: {
    taskId: number;
    studentId: number;
    fileId: string | null;
    note: string | null;
    submittedAt: Date;
  }): Promise<number>;
}

export interface SubmitTaskCheckInInput {
  taskId: number;
  studentId: number;
  fileId: string | null;
  note: string | null;
}

export interface SubmitTaskCheckInResult {
  checkInId: number;
  status: "submitted";
}

export interface TaskCheckInService {
  submitTaskCheckIn(input: SubmitTaskCheckInInput): Promise<SubmitTaskCheckInResult>;
}

export interface CreateTaskCheckInServiceInput {
  taskCheckInRepo: TaskCheckInRepository;
}

export class TaskCheckInTaskNotFoundError extends Error {
  constructor() {
    super("task not found");
    this.name = "TaskCheckInTaskNotFoundError";
  }
}

export class TaskCheckInCertificateNotFoundError extends Error {
  constructor() {
    super("certificate file not found");
    this.name = "TaskCheckInCertificateNotFoundError";
  }
}

export const createTaskCheckInService = ({
  taskCheckInRepo
}: CreateTaskCheckInServiceInput): TaskCheckInService => {
  return {
    async submitTaskCheckIn({
      taskId,
      studentId,
      fileId,
      note
    }: SubmitTaskCheckInInput): Promise<SubmitTaskCheckInResult> {
      const task = await taskCheckInRepo.findTaskByIdAndStudentId(taskId, studentId);
      if (!task) {
        throw new TaskCheckInTaskNotFoundError();
      }

      if (fileId) {
        const hasFile = await taskCheckInRepo.hasCertificateFileForStudent(studentId, fileId);
        if (!hasFile) {
          throw new TaskCheckInCertificateNotFoundError();
        }
      }

      const checkInId = await taskCheckInRepo.upsertTaskCheckIn({
        taskId,
        studentId,
        fileId,
        note,
        submittedAt: new Date()
      });

      return {
        checkInId,
        status: "submitted"
      };
    }
  };
};
