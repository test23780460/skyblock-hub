import type { AuthenticatedUser } from "./current-user";
import type { RepositoryProvider } from "@/lib/repositories/contracts";

export async function ensureCanonicalUser(repositories: RepositoryProvider, identity: AuthenticatedUser) {
  const existing = await repositories.identity.findUserByExternalIdentity(identity.provider, identity.providerSubject);
  if (existing) {
    await repositories.identity.upsertExternalIdentity({
      id: await stableIdentityId(identity),
      userId: existing.id,
      provider: identity.provider,
      providerSubject: identity.providerSubject,
      emailNormalized: identity.email.trim().toLowerCase(),
      lastLoginAt: new Date(),
    });
    return existing;
  }

  const userId = await stableUserId(identity);
  let user = await repositories.identity.getUser(userId);
  if (!user) {
    try {
      user = await repositories.identity.createUser({
        id: userId,
        displayName: identity.displayName.slice(0, 120),
      });
    } catch (error) {
      user = await repositories.identity.getUser(userId);
      if (!user) throw error;
    }
  }
  await repositories.identity.upsertExternalIdentity({
    id: await stableIdentityId(identity),
    userId: user.id,
    provider: identity.provider,
    providerSubject: identity.providerSubject,
    emailNormalized: identity.email.trim().toLowerCase(),
    lastLoginAt: new Date(),
  });
  return user;
}

async function stableUserId(identity: AuthenticatedUser): Promise<string> {
  return `user_${(await identityDigest(identity)).slice(0, 48)}`;
}

async function stableIdentityId(identity: AuthenticatedUser): Promise<string> {
  return `identity_${(await identityDigest(identity)).slice(0, 48)}`;
}

async function identityDigest(identity: AuthenticatedUser): Promise<string> {
  const bytes = new TextEncoder().encode(`${identity.provider}\n${identity.providerSubject}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
