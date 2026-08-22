import type { Metadata } from "next";
import { AccountExperience, type AccountPersistenceState } from "@/components/AccountExperience";
import { accountSignInPath, accountSignOutPath, getCurrentUser } from "@/lib/auth/current-user";
import { featureFlags } from "@/lib/config";
import { createDrizzleRepositoryProvider } from "@/lib/repositories/drizzle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  const authEnabled = featureFlags.accountAuth;
  let persistenceState: AccountPersistenceState = authEnabled ? user ? "unavailable" : "anonymous" : "disabled";
  if (user) {
    try {
      const { getDb } = await import("@/db");
      const repositories = createDrizzleRepositoryProvider(getDb());
      const canonicalUser = await repositories.identity.findUserByExternalIdentity(user.provider, user.providerSubject);
      persistenceState = canonicalUser ? "active" : "absent";
    } catch {
      persistenceState = "unavailable";
    }
  }
  return <AccountExperience
    authEnabled={authEnabled}
    persistenceState={persistenceState}
    signInHref={accountSignInPath("/account")}
    signOutHref={accountSignOutPath()}
    user={user ? { displayName: user.displayName, email: user.email } : null}
  />;
}
