export type ActivityType = "course" | "competition" | "project";

export interface PublishActivityInput {
  activityType: ActivityType;
  title: string;
}

export interface ActivityRepository {
  publishActivity(input: PublishActivityInput): Promise<void>;
}

export interface ActivityService {
  publishActivity(input: PublishActivityInput): Promise<void>;
}

export interface CreateActivityServiceInput {
  activityRepo: ActivityRepository;
}

export const createActivityService = ({ activityRepo }: CreateActivityServiceInput): ActivityService => {
  return {
    async publishActivity(input: PublishActivityInput): Promise<void> {
      await activityRepo.publishActivity(input);
    }
  };
};
