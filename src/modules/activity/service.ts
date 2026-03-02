export type ActivityType = "course" | "competition" | "project";
export type ActivityScopeType = "school" | "college" | "class";
export type ActivityStatus = "draft" | "published" | "closed";

export interface ActivityTimelineNode {
  key: string;
  at: string;
}

export interface PublishActivityInput {
  activityType: ActivityType;
  title: string;
  scopeType: ActivityScopeType;
  scopeTargetId: number;
  ownerTeacherId: string;
  startAt: Date;
  endAt: Date;
  timelineNodes: ActivityTimelineNode[];
  status?: ActivityStatus;
}

export interface ActivitySummary {
  activityId: number;
  activityType: ActivityType;
  title: string;
  scopeType: ActivityScopeType;
  scopeTargetId: number;
  ownerTeacherId: string;
  startAt: Date;
  endAt: Date;
  status: ActivityStatus;
  timelineNodes: ActivityTimelineNode[];
}

export interface ActivityRepository {
  publishActivity(input: PublishActivityInput): Promise<{ activityId: number }>;
  listActivities(): Promise<ActivitySummary[]>;
}

export interface ActivityService {
  publishActivity(input: PublishActivityInput): Promise<{ activityId: number }>;
  listActivities(): Promise<ActivitySummary[]>;
}

export interface CreateActivityServiceInput {
  activityRepo: ActivityRepository;
}

export const createActivityService = ({ activityRepo }: CreateActivityServiceInput): ActivityService => {
  return {
    async publishActivity(input: PublishActivityInput): Promise<{ activityId: number }> {
      if (input.endAt.getTime() < input.startAt.getTime()) {
        throw new Error("activity endAt must be greater than or equal to startAt");
      }

      return activityRepo.publishActivity({
        ...input,
        status: input.status ?? "published"
      });
    },
    async listActivities(): Promise<ActivitySummary[]> {
      return activityRepo.listActivities();
    }
  };
};
