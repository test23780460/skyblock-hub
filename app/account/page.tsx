import type { Metadata } from "next";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { AccountExperience, type AccountPersistenceState } from "@/components/AccountExperience";
import { featureFlags } from "@/lib/config";
import { createDrizzleRepositoryProvider } from "@/lib/repositories/drizzle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await getChatGPTUser();
  const authEnabled = featureFlags.chatGptAuth;
  let persistenceState: AccountPersistenceState = authEnabled ? user ? "unavailable" : "anonymous" : "disabled";
  if (user) {
    try {
      const { getDb } = await import("@/db");
      const repositories = createDrizzleRepositoryProvider(getDb());
      const canonicalUser = await repositories.identity.findUserByExternalIdentity("chatgpt", user.userId);
      persistenceState = canonicalUser ? "active" : "absent";
    } catch {
      persistenceState = "unavailable";
    }
  }
  return <AccountExperience
    authEnabled={authEnabled}
    persistenceState={persistenceState}
    signInHref={chatGPTSignInPath("/account")}
    signOutHref={chatGPTSignOutPath("/")}
    user={user ? { displayName: user.displayName, email: user.email } : null}
  />;
}
