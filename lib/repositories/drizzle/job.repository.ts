import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { jobRuns, jobs } from "@/db/schema";
import type { JobRepository } from "../contracts";

export class DrizzleJobRepository implements JobRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsertJob(input: Parameters<JobRepository["upsertJob"]>[0]): Promise<void> {
    const values = {
      id: input.id,
      name: input.name,
      queue: input.queue ?? "default",
      isEnabled: input.isEnabled ?? true,
      maxAttempts: input.maxAttempts ?? 3,
      timeoutMs: input.timeoutMs ?? 60_000,
      scheduleHint: input.scheduleHint ?? null,
      defaultPayload: input.defaultPayload ?? null,
    };

    await this.db
      .insert(jobs)
      .values(values)
      .onConflictDoUpdate({
        target: jobs.name,
        set: {
          queue: values.queue,
          isEnabled: values.isEnabled,
          maxAttempts: values.maxAttempts,
          timeoutMs: values.timeoutMs,
          scheduleHint: values.scheduleHint,
          defaultPayload: values.defaultPayload,
          updatedAt: new Date(),
        },
      });
  }

  async createRun(input: Parameters<JobRepository["createRun"]>[0]): Promise<void> {
    await this.db.insert(jobRuns).values({
      id: input.id,
      jobId: input.jobId,
      payload: input.payload ?? null,
      scheduler: input.scheduler ?? null,
      scheduledAt: input.scheduledAt ?? null,
    });
  }

  async updateRun(
    runId: string,
    update: Parameters<JobRepository["updateRun"]>[1],
  ): Promise<void> {
    const values: Partial<typeof jobRuns.$inferInsert> = {
      status: update.status,
      updatedAt: new Date(),
    };
    if ("startedAt" in update) values.startedAt = update.startedAt ?? null;
    if ("finishedAt" in update) values.finishedAt = update.finishedAt ?? null;
    if ("result" in update) values.result = update.result ?? null;
    if ("errorCode" in update) values.errorCode = update.errorCode ?? null;
    if ("errorMessage" in update) values.errorMessage = update.errorMessage ?? null;

    await this.db.update(jobRuns).set(values).where(eq(jobRuns.id, runId));
  }
}
