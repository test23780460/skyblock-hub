import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { featureFlags } from "../config";
import {
  accountSignInPath,
  isCloudflareAccessConfigured,
  verifiedCloudflareAccessUser,
  type AuthenticatedUser,
} from "./cloudflare-access";

export {
  accountSignInPath,
  accountSignOutPath,
  isCloudflareAccessConfigured,
  safeAuthReturnPath,
  type AuthenticatedUser,
} from "./cloudflare-access";

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!featureFlags.accountAuth || !isCloudflareAccessConfigured()) {
    return null;
  }
  return verifiedCloudflareAccessUser(await headers());
}

export async function requireCurrentUser(returnTo: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(accountSignInPath(returnTo));
}
