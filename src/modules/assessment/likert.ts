export interface LikertQuestion {
  questionId: number;
  content: string;
  dimension: "interest" | "ability" | "value";
}

export interface LikertQuestionSet {
  version: "v1";
  scaleMin: 1;
  scaleMax: 5;
  questions: LikertQuestion[];
}

export interface LikertAnswerInput {
  questionId: number;
  score: number;
}

export interface PersistLikertSubmissionInput {
  studentId: number;
  answersJson: string;
  answerCount: number;
  submittedAt: Date;
}

export interface UpdateLikertSubmissionInput extends PersistLikertSubmissionInput {
  id: number;
}

export interface LikertSubmissionRecord {
  id: number;
  studentId: number;
  answersJson: string;
  answerCount: number;
}

export interface LikertAssessmentSubmissionRepository {
  findSubmissionByStudentId(studentId: number): Promise<LikertSubmissionRecord | null>;
  createSubmission(input: PersistLikertSubmissionInput): Promise<number>;
  updateSubmission(input: UpdateLikertSubmissionInput): Promise<void>;
}

export interface SubmitLikertAnswersInput {
  studentId: number;
  answers: LikertAnswerInput[];
}

export interface SubmitLikertAnswersResult {
  submissionId: number;
  overwritten: boolean;
  answerCount: number;
  submittedAt: string;
}

export interface LikertAssessmentService {
  getQuestions(): Promise<LikertQuestionSet>;
  submitAnswers(input: SubmitLikertAnswersInput): Promise<SubmitLikertAnswersResult>;
}

export interface CreateLikertAssessmentServiceInput {
  submissionRepo: LikertAssessmentSubmissionRepository;
}

export class InvalidLikertAnswersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLikertAnswersError";
  }
}

const LIKERT_QUESTION_COUNT = 50;

const LIKERT_QUESTIONS: LikertQuestion[] = [
  { questionId: 1, content: "我会主动关注就业与升学相关信息。", dimension: "interest" },
  { questionId: 2, content: "我愿意持续投入时间探索未来职业方向。", dimension: "interest" },
  { questionId: 3, content: "我对参加职业体验活动有较强兴趣。", dimension: "interest" },
  { questionId: 4, content: "我会主动向老师或学长请教职业发展问题。", dimension: "interest" },
  { questionId: 5, content: "我愿意尝试不同领域以明确个人方向。", dimension: "interest" },
  { questionId: 6, content: "我对专业相关岗位保持长期关注。", dimension: "interest" },
  { questionId: 7, content: "我愿意阅读政策与行业报告了解趋势。", dimension: "interest" },
  { questionId: 8, content: "我会主动复盘自己的学习与实践经历。", dimension: "interest" },
  { questionId: 9, content: "我希望尽早形成清晰的生涯规划。", dimension: "interest" },
  { questionId: 10, content: "我愿意为目标岗位持续提升竞争力。", dimension: "interest" },
  { questionId: 11, content: "我能清楚表达自己的优势与特长。", dimension: "ability" },
  { questionId: 12, content: "我具备将课堂知识应用到实际问题的能力。", dimension: "ability" },
  { questionId: 13, content: "我能独立完成并按时交付学习任务。", dimension: "ability" },
  { questionId: 14, content: "我能在团队中高效沟通并协同推进。", dimension: "ability" },
  { questionId: 15, content: "我能快速学习新工具并用于解决问题。", dimension: "ability" },
  { questionId: 16, content: "我在压力下仍能保持稳定执行。", dimension: "ability" },
  { questionId: 17, content: "我具备基本的职业素养与规则意识。", dimension: "ability" },
  { questionId: 18, content: "我能根据反馈及时调整学习与行动策略。", dimension: "ability" },
  { questionId: 19, content: "我能持续积累可展示的项目或成果。", dimension: "ability" },
  { questionId: 20, content: "我能对复杂任务进行拆解并制定计划。", dimension: "ability" },
  { questionId: 21, content: "我认可长期主义对个人发展的价值。", dimension: "value" },
  { questionId: 22, content: "我更重视岗位与个人能力匹配度。", dimension: "value" },
  { questionId: 23, content: "我愿意在择业时兼顾社会责任。", dimension: "value" },
  { questionId: 24, content: "我认同持续学习是职业发展的基础。", dimension: "value" },
  { questionId: 25, content: "我愿意为长期目标接受阶段性挑战。", dimension: "value" },
  { questionId: 26, content: "我重视职业选择中的诚信与规范。", dimension: "value" },
  { questionId: 27, content: "我认为自我驱动比外部督促更重要。", dimension: "value" },
  { questionId: 28, content: "我愿意通过实践服务社会与他人。", dimension: "value" },
  { questionId: 29, content: "我会在重大选择前充分评估风险。", dimension: "value" },
  { questionId: 30, content: "我能够平衡短期收益与长期成长。", dimension: "value" },
  { questionId: 31, content: "我会主动制定并执行每周学习计划。", dimension: "interest" },
  { questionId: 32, content: "我会关注目标岗位所需能力变化。", dimension: "interest" },
  { questionId: 33, content: "我愿意主动参与校内外职业活动。", dimension: "interest" },
  { questionId: 34, content: "我对生涯课程或讲座保持积极态度。", dimension: "interest" },
  { questionId: 35, content: "我愿意根据兴趣拓展跨学科学习。", dimension: "interest" },
  { questionId: 36, content: "我能独立完成简历与作品集准备。", dimension: "ability" },
  { questionId: 37, content: "我能在公开场景清晰表达观点。", dimension: "ability" },
  { questionId: 38, content: "我具备基础数据分析与信息检索能力。", dimension: "ability" },
  { questionId: 39, content: "我能将抽象目标转化为可执行任务。", dimension: "ability" },
  { questionId: 40, content: "我能在失败后快速总结并再次尝试。", dimension: "ability" },
  { questionId: 41, content: "我认同职业发展应兼顾个人与家庭。", dimension: "value" },
  { questionId: 42, content: "我愿意在合规前提下追求效率。", dimension: "value" },
  { questionId: 43, content: "我重视对团队与组织的承诺。", dimension: "value" },
  { questionId: 44, content: "我认同跨地域发展的可能性与价值。", dimension: "value" },
  { questionId: 45, content: "我愿意在不确定环境中保持行动。", dimension: "value" },
  { questionId: 46, content: "我会主动规划实习或项目实践路径。", dimension: "interest" },
  { questionId: 47, content: "我愿意提前准备求职或升学关键节点。", dimension: "interest" },
  { questionId: 48, content: "我能对外部信息进行独立判断。", dimension: "ability" },
  { questionId: 49, content: "我能在时间冲突中合理安排优先级。", dimension: "ability" },
  { questionId: 50, content: "我认可以终为始的长期规划方式。", dimension: "value" }
];

const validateLikertAnswers = (answers: LikertAnswerInput[]) => {
  if (!Array.isArray(answers) || answers.length !== LIKERT_QUESTION_COUNT) {
    throw new InvalidLikertAnswersError("answers must include exactly 50 likert items");
  }

  const questionIds = new Set<number>();

  for (const item of answers) {
    if (!Number.isInteger(item.questionId) || item.questionId < 1 || item.questionId > LIKERT_QUESTION_COUNT) {
      throw new InvalidLikertAnswersError("questionId must be integer and between 1 and 50");
    }

    if (!Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
      throw new InvalidLikertAnswersError("score must be integer and between 1 and 5");
    }

    questionIds.add(item.questionId);
  }

  if (questionIds.size !== LIKERT_QUESTION_COUNT) {
    throw new InvalidLikertAnswersError("questionId must cover 1-50 without duplicates");
  }
};

const normalizeAnswers = (answers: LikertAnswerInput[]): LikertAnswerInput[] => {
  return [...answers].sort((left, right) => left.questionId - right.questionId);
};

export const createLikertAssessmentService = ({
  submissionRepo
}: CreateLikertAssessmentServiceInput): LikertAssessmentService => {
  return {
    async getQuestions(): Promise<LikertQuestionSet> {
      return {
        version: "v1",
        scaleMin: 1,
        scaleMax: 5,
        questions: LIKERT_QUESTIONS
      };
    },
    async submitAnswers({ studentId, answers }: SubmitLikertAnswersInput): Promise<SubmitLikertAnswersResult> {
      validateLikertAnswers(answers);

      const normalizedAnswers = normalizeAnswers(answers);
      const answersJson = JSON.stringify(normalizedAnswers);
      const submittedAt = new Date();
      const existing = await submissionRepo.findSubmissionByStudentId(studentId);

      if (existing) {
        await submissionRepo.updateSubmission({
          id: existing.id,
          studentId,
          answersJson,
          answerCount: LIKERT_QUESTION_COUNT,
          submittedAt
        });

        return {
          submissionId: existing.id,
          overwritten: true,
          answerCount: LIKERT_QUESTION_COUNT,
          submittedAt: submittedAt.toISOString()
        };
      }

      const createdId = await submissionRepo.createSubmission({
        studentId,
        answersJson,
        answerCount: LIKERT_QUESTION_COUNT,
        submittedAt
      });

      return {
        submissionId: createdId,
        overwritten: false,
        answerCount: LIKERT_QUESTION_COUNT,
        submittedAt: submittedAt.toISOString()
      };
    }
  };
};
