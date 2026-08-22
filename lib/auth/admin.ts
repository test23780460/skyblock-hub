import type { AuthenticatedUser } from "./current-user";

export function isAdminUser(user: AuthenticatedUser | null): boolean {
  return isAdminUserId(user?.providerSubject ?? null);
}

export function isAdminUserId(userId: string | null): boolean {
  if (!userId) return false;
  const allowed = new Set((process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(userId);
}
