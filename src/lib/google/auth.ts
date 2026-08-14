import "server-only";
import { google } from "googleapis";
import { getGoogleServiceAccountEnv } from "@/lib/env.server";

// Shared by every lib/google/* module. Returns null when the domain-wide-delegated
// service account isn't configured yet — that's a separate provisioning step requiring
// the client's Workspace super-admin (see plan.md §7 risks), not something auth should
// block on.
export function createGoogleAuthClient(scopes: string[]) {
  const env = getGoogleServiceAccountEnv();
  if (!env) return null;

  return new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes,
    subject: env.GOOGLE_ADMIN_IMPERSONATE_EMAIL,
  });
}
