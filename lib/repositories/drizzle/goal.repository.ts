import { and, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { goals, recommendationStates } from "@/db/schema";
import type {
  CreateGoalInput,
  GoalRecord,
  GoalRepository,
  GoalStatus,
  RecommendationStateInput,
  UpdateGoalInput,
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

  async getGoal(userId: string, goalId: string): Promise<GoalRecord | null> {
    const [goal] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    return goal ?? null;
  }

  async listGoals(userId: string, status?: GoalStatus, limit = 100): Promise<GoalRecord[]> {
    const boundedLimit = Number.isFinite(limit) && limit > 0
      ? Math.max(1, Math.min(200, Math.floor(limit)))
      : 100;
    return this.db
      .select()
      .from(goals)
      .where(status ? and(eq(goals.userId, userId), eq(goals.status, status)) : eq(goals.userId, userId))
      .orderBy(desc(goals.updatedAt))
      .limit(boundedLimit);
  }

  async updateGoal(
    userId: string,
    goalId: string,
    input: UpdateGoalInput,
  ): Promise<GoalRecord | null> {
    const [goal] = await this.db
      .update(goals)
      .set({
        title: input.title,
        goalType: input.goalType,
        status: input.status,
        progressPercent: input.progressPercent,
        target: input.target,
        completedAt: input.completedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning();
    return goal ?? null;
  }

  async deleteGoal(userId: string, goalId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning({ id: goals.id });
    return deleted.length > 0;
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
