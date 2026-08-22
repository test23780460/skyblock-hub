import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createAdminAiMetricsGetHandler,
  getAiAdminMetricsSnapshot,
} from "@/lib/ai/admin-metrics";
import { isAdminUserId } from "@/lib/auth/admin";
import { featureFlags } from "@/lib/config";

export const GET = createAdminAiMetricsGetHandler({
  authEnabled: () => featureFlags.accountAuth,
  authenticate: async () => {
    const user = await getCurrentUser();
    return user ? { id: user.providerSubject } : null;
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
