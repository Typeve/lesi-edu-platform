import test from "node:test";
import assert from "node:assert/strict";
import { Hono, type MiddlewareHandler } from "hono";
import { createStudentRoutes } from "../../src/routes/student.ts";
import {
  createLikertAssessmentService,
  type LikertAssessmentSubmissionRepository
} from "../../src/modules/assessment/likert.ts";

const authorizedStudentMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header("authorization") ?? "";

  if (authorization !== "Bearer valid-token") {
    return c.json({ message: "unauthorized" }, 401);
  }

  c.set("studentAuth", {
    studentId: 1001,
    studentNo: "S20261001",
    mustChangePassword: false
  });

  await next();
};

const makeAnswers = () =>
  Array.from({ length: 50 }, (_, index) => ({
    questionId: index + 1,
    score: ((index % 5) + 1)
  }));

test("likert assessment service should return 50 questions", async () => {
  const repo: LikertAssessmentSubmissionRepository = {
    async findSubmissionByStudentId() {
      return null;
    },
    async createSubmission() {
      return 1;
    },
    async updateSubmission() {
      return;
    }
  };

  const service = createLikertAssessmentService({
    submissionRepo: repo
  });

  const result = await service.getQuestions();

  assert.equal(result.questions.length, 50);
  assert.equal(result.questions[0].questionId, 1);
  assert.equal(result.questions[49].questionId, 50);
});

test("likert assessment submit should overwrite previous answers for same student", async () => {
  const store = new Map<number, { id: number; answersJson: string; answerCount: number }>();
  let nextId = 1;

  const repo: LikertAssessmentSubmissionRepository = {
    async findSubmissionByStudentId(studentId) {
      const hit = store.get(studentId);
      if (!hit) {
        return null;
      }

      return {
        id: hit.id,
        studentId,
        answersJson: hit.answersJson,
        answerCount: hit.answerCount
      };
    },
    async createSubmission(input) {
      const id = nextId++;
      store.set(input.studentId, {
        id,
        answersJson: input.answersJson,
        answerCount: input.answerCount
      });
      return id;
    },
    async updateSubmission(input) {
      store.set(input.studentId, {
        id: input.id,
        answersJson: input.answersJson,
        answerCount: input.answerCount
      });
    }
  };

  const service = createLikertAssessmentService({
    submissionRepo: repo
  });

  const first = await service.submitAnswers({
    studentId: 1001,
    answers: makeAnswers()
  });

  const second = await service.submitAnswers({
    studentId: 1001,
    answers: makeAnswers().map((item) => ({ ...item, score: 5 }))
  });

  assert.equal(first.overwritten, false);
  assert.equal(second.overwritten, true);
  assert.equal(store.size, 1);
});

test("GET /student/assessments/questions should return 50 questions after login", async () => {
  const repo: LikertAssessmentSubmissionRepository = {
    async findSubmissionByStudentId() {
      return null;
    },
    async createSubmission() {
      return 1;
    },
    async updateSubmission() {
      return;
    }
  };

  const app = new Hono();
  app.route(
    "/student",
    createStudentRoutes({
      requireStudentAuth: authorizedStudentMiddleware,
      certificateUploadService: {
        async uploadCertificate() {
          throw new Error("not implemented");
        }
      },
      likertAssessmentService: createLikertAssessmentService({
        submissionRepo: repo
      })
    })
  );

  const response = await app.request("/student/assessments/questions", {
    headers: {
      authorization: "Bearer valid-token"
    }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.questions.length, 50);
});

test("POST /student/assessments/submissions should return 400 when answers is not complete 50", async () => {
  const repo: LikertAssessmentSubmissionRepository = {
    async findSubmissionByStudentId() {
      return null;
    },
    async createSubmission() {
      return 1;
    },
    async updateSubmission() {
      return;
    }
  };

  const app = new Hono();
  app.route(
    "/student",
    createStudentRoutes({
      requireStudentAuth: authorizedStudentMiddleware,
      certificateUploadService: {
        async uploadCertificate() {
          throw new Error("not implemented");
        }
      },
      likertAssessmentService: createLikertAssessmentService({
        submissionRepo: repo
      })
    })
  );

  const response = await app.request("/student/assessments/submissions", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      answers: makeAnswers().slice(0, 49)
    })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    message: "answers must include exactly 50 likert items"
  });
});

test("POST /student/assessments/submissions should persist and overwrite consistently", async () => {
  const store = new Map<number, { id: number; answersJson: string; answerCount: number }>();
  let nextId = 1;

  const repo: LikertAssessmentSubmissionRepository = {
    async findSubmissionByStudentId(studentId) {
      const hit = store.get(studentId);
      if (!hit) {
        return null;
      }

      return {
        id: hit.id,
        studentId,
        answersJson: hit.answersJson,
        answerCount: hit.answerCount
      };
    },
    async createSubmission(input) {
      const id = nextId++;
      store.set(input.studentId, {
        id,
        answersJson: input.answersJson,
        answerCount: input.answerCount
      });
      return id;
    },
    async updateSubmission(input) {
      store.set(input.studentId, {
        id: input.id,
        answersJson: input.answersJson,
        answerCount: input.answerCount
      });
    }
  };

  const app = new Hono();
  app.route(
    "/student",
    createStudentRoutes({
      requireStudentAuth: authorizedStudentMiddleware,
      certificateUploadService: {
        async uploadCertificate() {
          throw new Error("not implemented");
        }
      },
      likertAssessmentService: createLikertAssessmentService({
        submissionRepo: repo
      })
    })
  );

  const first = await app.request("/student/assessments/submissions", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({ answers: makeAnswers() })
  });

  const second = await app.request("/student/assessments/submissions", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      answers: makeAnswers().map((item) => ({ ...item, score: 5 }))
    })
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);

  const firstPayload = await first.json();
  const secondPayload = await second.json();

  assert.equal(firstPayload.overwritten, false);
  assert.equal(secondPayload.overwritten, true);
  assert.equal(store.size, 1);
});
