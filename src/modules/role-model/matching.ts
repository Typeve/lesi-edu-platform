export type RoleModelDirection = "employment" | "postgraduate" | "civil_service";
export type RoleModelMatchingStrategy = "same_school_same_major" | "score_gap_fallback";

export interface StudentEnrollmentProfile {
  studentNo: string;
  schoolName: string | null;
  majorName: string | null;
  score: number | null;
}

export interface RoleModelCandidate {
  studentNo: string;
  name: string;
  schoolName: string | null;
  majorName: string | null;
  score: number | null;
  direction: RoleModelDirection;
}

export interface RoleModelMatchingRepository {
  findStudentEnrollmentProfile(studentNo: string): Promise<StudentEnrollmentProfile | null>;
  listRoleModelCandidates(direction: RoleModelDirection): Promise<RoleModelCandidate[]>;
}

export interface MatchRoleModelsInput {
  studentNo: string;
  direction: RoleModelDirection;
}

export interface MatchRoleModelsResult {
  strategy: RoleModelMatchingStrategy;
  matched: Array<RoleModelCandidate & { scoreGap: number | null }>;
}

export interface RoleModelMatchingService {
  matchRoleModels(input: MatchRoleModelsInput): Promise<MatchRoleModelsResult>;
}

export interface CreateRoleModelMatchingServiceInput {
  roleModelRepo: RoleModelMatchingRepository;
  maxMatched?: number;
}

export class RoleModelMatchingNotFoundError extends Error {
  constructor() {
    super("student enrollment profile not found");
    this.name = "RoleModelMatchingNotFoundError";
  }
}

const resolveScoreGap = (selfScore: number | null, candidateScore: number | null): number | null => {
  if (selfScore === null || candidateScore === null) {
    return null;
  }

  return Math.abs(selfScore - candidateScore);
};

const sortByScoreGap = (
  selfScore: number | null,
  candidates: RoleModelCandidate[]
): Array<RoleModelCandidate & { scoreGap: number | null }> => {
  return candidates
    .map((candidate) => ({
      ...candidate,
      scoreGap: resolveScoreGap(selfScore, candidate.score)
    }))
    .sort((left, right) => {
      const leftGap = left.scoreGap ?? Number.MAX_SAFE_INTEGER;
      const rightGap = right.scoreGap ?? Number.MAX_SAFE_INTEGER;
      return leftGap - rightGap;
    });
};

export const createRoleModelMatchingService = ({
  roleModelRepo,
  maxMatched = 10
}: CreateRoleModelMatchingServiceInput): RoleModelMatchingService => {
  return {
    async matchRoleModels({ studentNo, direction }: MatchRoleModelsInput): Promise<MatchRoleModelsResult> {
      const studentProfile = await roleModelRepo.findStudentEnrollmentProfile(studentNo);
      if (!studentProfile) {
        throw new RoleModelMatchingNotFoundError();
      }

      const allCandidates = (await roleModelRepo.listRoleModelCandidates(direction)).filter(
        (candidate) => candidate.studentNo !== studentNo
      );

      const sameSchoolSameMajorCandidates = allCandidates.filter(
        (candidate) =>
          Boolean(studentProfile.schoolName) &&
          Boolean(studentProfile.majorName) &&
          candidate.schoolName === studentProfile.schoolName &&
          candidate.majorName === studentProfile.majorName
      );

      const useSameSchoolMajor = sameSchoolSameMajorCandidates.length > 0;
      const baseCandidates = useSameSchoolMajor ? sameSchoolSameMajorCandidates : allCandidates;
      const sorted = sortByScoreGap(studentProfile.score, baseCandidates);

      return {
        strategy: useSameSchoolMajor ? "same_school_same_major" : "score_gap_fallback",
        matched: sorted.slice(0, maxMatched)
      };
    }
  };
};
