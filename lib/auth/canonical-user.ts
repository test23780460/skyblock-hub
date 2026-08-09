import type { ChatGPTUser } from "@/app/chatgpt-auth";
import type { RepositoryProvider } from "@/lib/repositories/contracts";

export async function ensureCanonicalUser(repositories: RepositoryProvider, identity: ChatGPTUser) {
  const existing = await repositories.identity.findUserByExternalIdentity("chatgpt", identity.userId);
  if (existing) {
    await repositories.identity.upsertExternalIdentity({
      id: "identity_" + crypto.randomUUID(),
      userId: existing.id,
      provider: "chatgpt",
      providerSubject: identity.userId,
      emailNormalized: identity.email.trim().toLowerCase(),
      lastLoginAt: new Date(),
    });
    return existing;
  }

  const user = await repositories.identity.createUser({ id: "user_" + crypto.randomUUID(), displayName: identity.displayName.slice(0, 120) });
  await repositories.identity.upsertExternalIdentity({
    id: "identity_" + crypto.randomUUID(),
    userId: user.id,
    provider: "chatgpt",
    providerSubject: identity.userId,
    emailNormalized: identity.email.trim().toLowerCase(),
    lastLoginAt: new Date(),
  });
  return user;
}
