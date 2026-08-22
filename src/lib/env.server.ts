import "server-only";
import { z } from "zod";

export { publicEnv } from "@/lib/env";

const serviceRoleSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

// Validated lazily, at the point something actually needs it (lib/supabase/admin.ts) —
// not at module load — so `next dev` doesn't hard-fail on auth-only work before the
// service role key is configured.
export function getServiceRoleKey(): string {
  return serviceRoleSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }).SUPABASE_SERVICE_ROLE_KEY;
}

const googleServiceAccountSchema = z.object({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1),
  GOOGLE_ADMIN_IMPERSONATE_EMAIL: z.string().min(1),
});

export type GoogleServiceAccountEnv = z.infer<typeof googleServiceAccountSchema>;

// Returns null instead of throwing when unset — the Workspace service account is a
// separate provisioning step (needs the client's super-admin to grant domain-wide
// delegation, see plan.md §7 risks) and shouldn't block sign-in from working before it's
// ready. Callers (lib/google/*) fall back to a default role when this is null.
export function getGoogleServiceAccountEnv(): GoogleServiceAccountEnv | null {
  const result = googleServiceAccountSchema.safeParse({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    GOOGLE_ADMIN_IMPERSONATE_EMAIL: process.env.GOOGLE_ADMIN_IMPERSONATE_EMAIL,
  });
  return result.success ? result.data : null;
}

const googleOAuthSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
});

export type GoogleOAuthEnv = z.infer<typeof googleOAuthSchema>;

// The same Client ID/Secret already configured as Supabase's Google Auth provider (Supabase
// Dashboard → Authentication → Providers → Google) — needed here too so lib/google/
// calendar.ts can refresh a user's expired access_token itself, without round-tripping
// through Supabase. Distinct from the service account above: this is per-user OAuth consent
// (works with any Google account, including personal @gmail.com test accounts), not
// domain-wide delegation (Workspace-only — see calendar-sync notes in schema.md).
export function getGoogleOAuthEnv(): GoogleOAuthEnv | null {
  const result = googleOAuthSchema.safeParse({
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  return result.success ? result.data : null;
}
