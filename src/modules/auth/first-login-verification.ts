export interface StudentFirstLoginReferenceRecord {
  studentId: number;
  name: string;
  credentialNo: string | null;
  schoolName: string;
  majorName: string | null;
  firstLoginVerifiedAt: Date | null;
}

export interface MarkStudentFirstLoginVerifiedInput {
  studentId: number;
  verifiedAt: Date;
}

export interface StudentFirstLoginVerificationRepository {
  findStudentFirstLoginReference(studentId: number): Promise<StudentFirstLoginReferenceRecord | null>;
  markStudentFirstLoginVerified(input: MarkStudentFirstLoginVerifiedInput): Promise<void>;
}

export interface VerifyStudentFirstLoginInput {
  studentId: number;
  name: string;
  credentialNo: string;
  schoolName: string;
  majorName: string;
}

export interface VerifyStudentFirstLoginResult {
  verified: true;
  verifiedAt: string;
}

export interface StudentFirstLoginVerificationService {
  verifyStudentFirstLogin(input: VerifyStudentFirstLoginInput): Promise<VerifyStudentFirstLoginResult>;
}

export interface CreateStudentFirstLoginVerificationServiceInput {
  studentFirstLoginVerificationRepo: StudentFirstLoginVerificationRepository;
  nowProvider?: () => Date;
}

export class StudentFirstLoginVerificationNotFoundError extends Error {
  constructor() {
    super("student not found");
    this.name = "StudentFirstLoginVerificationNotFoundError";
  }
}

export class StudentFirstLoginVerificationMismatchError extends Error {
  reasons: string[];

  constructor(reasons: string[]) {
    super("first login verification failed");
    this.name = "StudentFirstLoginVerificationMismatchError";
    this.reasons = reasons;
  }
}

const normalize = (rawValue: string): string => rawValue.trim();

export const createStudentFirstLoginVerificationService = ({
  studentFirstLoginVerificationRepo,
  nowProvider = () => new Date()
}: CreateStudentFirstLoginVerificationServiceInput): StudentFirstLoginVerificationService => {
  return {
    async verifyStudentFirstLogin({
      studentId,
      name,
      credentialNo,
      schoolName,
      majorName
    }: VerifyStudentFirstLoginInput): Promise<VerifyStudentFirstLoginResult> {
      const reference = await studentFirstLoginVerificationRepo.findStudentFirstLoginReference(studentId);

      if (!reference) {
        throw new StudentFirstLoginVerificationNotFoundError();
      }

      if (reference.firstLoginVerifiedAt) {
        return {
          verified: true,
          verifiedAt: reference.firstLoginVerifiedAt.toISOString()
        };
      }

      const reasons: string[] = [];

      if (normalize(name) !== normalize(reference.name)) {
        reasons.push("姓名不匹配");
      }

      if (!reference.credentialNo || normalize(credentialNo) !== normalize(reference.credentialNo)) {
        reasons.push("证件号不匹配");
      }

      if (normalize(schoolName) !== normalize(reference.schoolName)) {
        reasons.push("院校信息不匹配");
      }

      if (!reference.majorName || normalize(majorName) !== normalize(reference.majorName)) {
        reasons.push("专业信息不匹配");
      }

      if (reasons.length > 0) {
        throw new StudentFirstLoginVerificationMismatchError(reasons);
      }

      const verifiedAt = nowProvider();

      await studentFirstLoginVerificationRepo.markStudentFirstLoginVerified({
        studentId,
        verifiedAt
      });

      return {
        verified: true,
        verifiedAt: verifiedAt.toISOString()
      };
    }
  };
};
