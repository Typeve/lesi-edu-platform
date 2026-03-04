import { LIKERT_QUESTIONS, type LikertAnswerInput } from "./likert.js";

export type AssessmentDirection = "employment" | "postgraduate" | "civil_service";

export interface LikertAssessmentResultRepository {
  findSubmissionByStudentId(studentId: number): Promise<{
    id: number;
    studentId: number;
    answersJson: string;
  } | null>;
}

export interface GetLikertAssessmentResultInput {
  studentId: number;
}

export interface LikertAssessmentResult {
  dimensionScores: {
    interest: number;
    ability: number;
    value: number;
  };
  weights: {
    interest: 0.4;
    ability: 0.4;
    value: 0.2;
  };
  scores: Array<{
    direction: AssessmentDirection;
    score: number;
  }>;
  recommendation: {
    direction: AssessmentDirection;
    reason: string;
  };
}

export interface LikertAssessmentResultService {
  getResult(input: GetLikertAssessmentResultInput): Promise<LikertAssessmentResult>;
}

export interface CreateLikertAssessmentResultServiceInput {
  resultRepo: LikertAssessmentResultRepository;
}

export class LikertAssessmentResultNotFoundError extends Error {
  constructor() {
    super("assessment submission not found");
    this.name = "LikertAssessmentResultNotFoundError";
  }
}

const roundToOneDecimal = (value: number): number => {
  return Math.round(value * 10) / 10;
};

const averageToHundredScale = (scores: number[]): number => {
  if (scores.length === 0) {
    return 0;
  }

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return roundToOneDecimal((average / 5) * 100);
};

const parseAnswers = (answersJson: string): LikertAnswerInput[] => {
  const parsed = JSON.parse(answersJson) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((item): item is LikertAnswerInput => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const questionId = (item as { questionId?: unknown }).questionId;
      const score = (item as { score?: unknown }).score;
      return Number.isInteger(questionId) && Number.isInteger(score);
    })
    .map((item) => ({
      questionId: item.questionId,
      score: item.score
    }));
};

const resolveRecommendationReason = (direction: AssessmentDirection): string => {
  switch (direction) {
    case "employment":
      return "你的兴趣驱动与执行能力匹配较高，建议优先走就业实践路径。";
    case "postgraduate":
      return "你的学术兴趣与价值稳定性较强，建议优先考虑考研深造。";
    case "civil_service":
      return "你的价值稳定性与执行力较高，建议优先考虑考公方向。";
    default:
      return "建议根据优势维度继续探索最适合的方向。";
  }
};

export const createLikertAssessmentResultService = ({
  resultRepo
}: CreateLikertAssessmentResultServiceInput): LikertAssessmentResultService => {
  return {
    async getResult({ studentId }: GetLikertAssessmentResultInput): Promise<LikertAssessmentResult> {
      const submission = await resultRepo.findSubmissionByStudentId(studentId);
      if (!submission) {
        throw new LikertAssessmentResultNotFoundError();
      }

      const answers = parseAnswers(submission.answersJson);
      const scoreByQuestionId = new Map<number, number>();
      for (const answer of answers) {
        scoreByQuestionId.set(answer.questionId, answer.score);
      }

      const interestScores: number[] = [];
      const abilityScores: number[] = [];
      const valueScores: number[] = [];

      for (const question of LIKERT_QUESTIONS) {
        const score = scoreByQuestionId.get(question.questionId);
        if (!score) {
          continue;
        }

        if (question.dimension === "interest") {
          interestScores.push(score);
          continue;
        }

        if (question.dimension === "ability") {
          abilityScores.push(score);
          continue;
        }

        valueScores.push(score);
      }

      const dimensionScores = {
        interest: averageToHundredScale(interestScores),
        ability: averageToHundredScale(abilityScores),
        value: averageToHundredScale(valueScores)
      };

      const employment = roundToOneDecimal(
        dimensionScores.interest * 0.4 + dimensionScores.ability * 0.4 + dimensionScores.value * 0.2
      );
      const postgraduate = roundToOneDecimal(
        dimensionScores.interest * 0.4 + dimensionScores.value * 0.4 + dimensionScores.ability * 0.2
      );
      const civilService = roundToOneDecimal(
        dimensionScores.value * 0.4 + dimensionScores.ability * 0.4 + dimensionScores.interest * 0.2
      );

      const scores: LikertAssessmentResult["scores"] = [
        { direction: "employment", score: employment },
        { direction: "postgraduate", score: postgraduate },
        { direction: "civil_service", score: civilService }
      ];
      scores.sort((left, right) => right.score - left.score);

      const recommendationDirection = scores[0]?.direction ?? "employment";

      return {
        dimensionScores,
        weights: {
          interest: 0.4,
          ability: 0.4,
          value: 0.2
        },
        scores,
        recommendation: {
          direction: recommendationDirection,
          reason: resolveRecommendationReason(recommendationDirection)
        }
      };
    }
  };
};
