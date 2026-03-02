import test from "node:test";
import assert from "node:assert/strict";
import { createActivityService } from "../../src/modules/activity/service.ts";

test("activity service should reject endAt earlier than startAt", async () => {
  const service = createActivityService({
    activityRepo: {
      async publishActivity() {
        return { activityId: 1 };
      },
      async listActivities() {
        return [];
      }
    }
  });

  await assert.rejects(
    () =>
      service.publishActivity({
        activityType: "course",
        title: "就业指导课",
        scopeType: "class",
        scopeTargetId: 11,
        ownerTeacherId: "teacher-1",
        startAt: new Date("2026-03-10T08:00:00.000Z"),
        endAt: new Date("2026-03-02T08:00:00.000Z"),
        timelineNodes: []
      }),
    /endAt/
  );
});
