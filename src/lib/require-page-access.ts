import "server-only";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/data/profiles";
import { can, type Action } from "@/lib/permissions";
import { ROUTES } from "@/constants/routes";

// Server-side page guard, the page-level counterpart to requirePermission() for Server
// Actions. Hiding a link in the sidebar is presentation, not authorization — anyone can type
// a URL — so every page whose whole purpose is off-limits to some role calls this first.
//
// getCurrentProfile() is request-cached, so a page that also needs the profile for its own
// rendering gets it back here rather than paying for a second round trip.
//
// Redirects to the dashboard rather than 403-ing: `dashboard.view` is granted to every role
// including `external`, so it is always a valid destination.
export async function requirePageAccess(action: Action) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(ROUTES.signIn);
  if (!can(profile.role, action)) redirect(ROUTES.dashboard);
  return profile;
}
