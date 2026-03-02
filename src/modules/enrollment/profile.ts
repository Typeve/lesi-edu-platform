export interface EnrollmentProfileRecord {
  studentNo: string;
  name: string | null;
  schoolName: string | null;
  majorName: string | null;
  score: number | null;
  admissionYear: number | null;
}

export interface EnrollmentProfileRepository {
  findEnrollmentProfileByStudentNo(studentNo: string): Promise<EnrollmentProfileRecord | null>;
}

export interface GetEnrollmentProfileInput {
  studentNo: string;
}

export type EnrollmentProfileField =
  | "name"
  | "schoolName"
  | "majorName"
  | "score"
  | "admissionYear";

export type EnrollmentProfileDataStatus = "complete" | "partial_missing" | "missing";

export interface EnrollmentProfileResult {
  studentNo: string;
  profile: {
    name: string | null;
    schoolName: string | null;
    majorName: string | null;
    score: number | null;
    admissionYear: number | null;
  };
  dataStatus: EnrollmentProfileDataStatus;
  missingFields: EnrollmentProfileField[];
  readonly: true;
}

export interface EnrollmentProfileService {
  getEnrollmentProfile(input: GetEnrollmentProfileInput): Promise<EnrollmentProfileResult>;
}

export interface CreateEnrollmentProfileServiceInput {
  enrollmentProfileRepo: EnrollmentProfileRepository;
}

const ENROLLMENT_FIELDS: EnrollmentProfileField[] = [
  "name",
  "schoolName",
  "majorName",
  "score",
  "admissionYear"
];

const resolveMissingFields = (
  profile: EnrollmentProfileResult["profile"]
): EnrollmentProfileField[] => {
  return ENROLLMENT_FIELDS.filter((field) => profile[field] === null);
};

const resolveDataStatus = (
  missingFields: EnrollmentProfileField[]
): EnrollmentProfileDataStatus => {
  if (missingFields.length === 0) {
    return "complete";
  }

  if (missingFields.length === ENROLLMENT_FIELDS.length) {
    return "missing";
  }

  return "partial_missing";
};

export const createEnrollmentProfileService = ({
  enrollmentProfileRepo
}: CreateEnrollmentProfileServiceInput): EnrollmentProfileService => {
  return {
    async getEnrollmentProfile({ studentNo }: GetEnrollmentProfileInput): Promise<EnrollmentProfileResult> {
      const rawProfile = await enrollmentProfileRepo.findEnrollmentProfileByStudentNo(studentNo);

      const profile = {
        name: rawProfile?.name ?? null,
        schoolName: rawProfile?.schoolName ?? null,
        majorName: rawProfile?.majorName ?? null,
        score: rawProfile?.score ?? null,
        admissionYear: rawProfile?.admissionYear ?? null
      };

      const missingFields = resolveMissingFields(profile);

      return {
        studentNo,
        profile,
        dataStatus: resolveDataStatus(missingFields),
        missingFields,
        readonly: true
      };
    }
  };
};
