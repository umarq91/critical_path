import { can } from "@/lib/permissions";
import { ROLE, type Role } from "@/constants/roles";
import { publicEnv } from "@/lib/env";

export interface CalendarEligibilityProfile {
  role: Role;
  email: string;
  status?: string | null;
}

// The one answer to "may this account push tasks to Google Calendar?", shared by the Server
// Action that performs the push and by the UI that decides whether to render the Sync button.
//
// Three positive conditions, all required — deliberately NOT "does a google_oauth_tokens row
// happen to exist". Token presence is a side effect of having signed in through Google at
// some point; it is not a statement about who this account is, it can be true for an account
// whose role has since changed, and an absent token is indistinguishable from a token that
// expired. Eligibility is a property of the account, so it is derived from the account.
//
// No `server-only` import here on purpose: this has to be callable from Client Components
// (calendar-toolbar.tsx) as well as Server Actions. publicEnv is client-safe.
export function isGoogleCalendarEligible(profile: CalendarEligibilityProfile): boolean {
  if (profile.role === ROLE.EXTERNAL) return false;
  if (profile.status && profile.status !== "active") return false;
  if (!can(profile.role, "calendar.sync_google")) return false;
  return isWorkspaceEmail(profile.email);
}

export function isWorkspaceEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${publicEnv.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN.toLowerCase()}`);
}
