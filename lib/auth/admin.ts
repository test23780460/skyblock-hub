import type { ChatGPTUser } from "@/app/chatgpt-auth";

export function isAdminUser(user: ChatGPTUser | null): boolean {
  if (!user) return false;
  const allowed = new Set((process.env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(user.userId);
}
