import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  createAdminAiMetricsGetHandler,
  getAiAdminMetricsSnapshot,
} from "@/lib/ai/admin-metrics";
import { isAdminUserId } from "@/lib/auth/admin";
import { featureFlags } from "@/lib/config";

export const GET = createAdminAiMetricsGetHandler({
  authEnabled: () => featureFlags.chatGptAuth,
  authenticate: async () => {
    const user = await getChatGPTUser();
    return user ? { id: user.userId } : null;
  },
  authorize: (identity) => isAdminUserId(identity.id),
  load: async () => {
    const [{ getDb }, { DrizzleTelemetryRepository }] = await Promise.all([
      import("@/db"),
      import("@/lib/repositories/drizzle/telemetry.repository"),
    ]);
    return getAiAdminMetricsSnapshot(new DrizzleTelemetryRepository(getDb()));
  },
});
