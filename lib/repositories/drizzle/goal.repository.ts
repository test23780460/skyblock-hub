import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { goalSteps, goals, recommendationStates } from "@/db/schema";
import type {
  CreateGoalInput,
  CreateGoalStepInput,
  GoalRecord,
  GoalRepository,
  GoalStatus,
  GoalStepStatus,
  RecommendationStateInput,
} from "../contracts";

export class DrizzleGoalRepository implements GoalRepository {
  constructor(private readonly db: AppDatabase) {}

  async createGoal(input: CreateGoalInput): Promise<GoalRecord> {
    const [goal] = await this.db
      .insert(goals)
      .values({
        id: input.id,
        userId: input.userId,
        profileId: input.profileId ?? null,
        goalType: input.goalType,
        title: input.title,
        description: input.description ?? null,
        target: input.target,
        dueAt: input.dueAt ?? null,
      })
      .returning();

    if (!goal) {
      throw new Error("Failed to create goal");
    }
    return goal;
  }

  async addStep(input: CreateGoalStepInput): Promise<void> {
    await this.db.insert(goalSteps).values({
      id: input.id,
      goalId: input.goalId,
      position: input.position,
      title: input.title,
      description: input.description ?? null,
      estimate: input.estimate ?? null,
    });
  }

  async listGoals(userId: string, status?: GoalStatus): Promise<GoalRecord[]> {
    return this.db
      .select()
      .from(goals)
      .where(status ? and(eq(goals.userId, userId), eq(goals.status, status)) : eq(goals.userId, userId))
      .orderBy(desc(goals.updatedAt));
  }

  async updateGoalProgress(
    goalId: string,
    progressPercent: number,
    status: GoalStatus,
    completedAt: Date | null = null,
  ): Promise<void> {
    await this.db
      .update(goals)
      .set({ progressPercent, status, completedAt, updatedAt: new Date() })
      .where(eq(goals.id, goalId));
  }

  async updateStepStatus(
    stepId: string,
    status: GoalStepStatus,
    completedAt: Date | null = null,
  ): Promise<void> {
    await this.db
      .update(goalSteps)
      .set({ status, completedAt, updatedAt: new Date() })
      .where(eq(goalSteps.id, stepId));
  }

  async upsertRecommendationState(input: RecommendationStateInput): Promise<void> {
    const values = {
      id: input.id,
      userId: input.userId,
      profileId: input.profileId,
      recommendationKey: input.recommendationKey,
      recommendationVersion: input.recommendationVersion ?? "1",
      category: input.category,
      state: input.state,
      context: input.context ?? null,
      remindAt: input.remindAt ?? null,
      completedAt: input.completedAt ?? null,
    };

    await this.db
      .insert(recommendationStates)
      .values(values)
      .onConflictDoUpdate({
        target: [
          recommendationStates.userId,
          recommendationStates.profileId,
          recommendationStates.recommendationKey,
        ],
        set: {
          recommendationVersion: values.recommendationVersion,
          category: values.category,
          state: values.state,
          context: values.context,
          remindAt: values.remindAt,
          completedAt: values.completedAt,
          updatedAt: new Date(),
        },
      });
  }
}

