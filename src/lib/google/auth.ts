import "server-only";
import { google } from "googleapis";
import { getGoogleServiceAccountEnv } from "@/lib/env.server";

// Shared by every lib/google/* module. Returns null when the domain-wide-delegated
// service account isn't configured yet — that's a separate provisioning step requiring
// the client's Workspace super-admin (see plan.md §7 risks), not something auth should
// block on.
//
// `subject` is who the service account impersonates — defaults to the fixed admin
// (admin-directory.ts's group-membership reads only work as an admin), but lib/google/
// calendar.ts always passes a specific user's email instead: a calendar sync must act as
// that user's own account, not the admin's, or events would land on the wrong calendar.
export function createGoogleAuthClient(scopes: string[], subject?: string) {
  const env = getGoogleServiceAccountEnv();
  if (!env) return null;

  return new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes,
    subject: subject ?? env.GOOGLE_ADMIN_IMPERSONATE_EMAIL,
  });
}
