import "server-only";
import { google, type admin_directory_v1 } from "googleapis";
import { createGoogleAuthClient } from "@/lib/google/auth";
import { ROLE, type Role } from "@/constants/roles";
import { getGroupRoleMap } from "@/constants/google-groups";

const DIRECTORY_SCOPES = ["https://www.googleapis.com/auth/admin.directory.group.readonly"];

// Reached only through reconcileProfileRole() (lib/google/role-sync.ts) — the OAuth callback
// today, the nightly group-sync cron when it lands. Do NOT call this directly.
//
// It returns null when the service account isn't configured or no GOOGLE_GROUP_*_EMAIL is set
// (callers keep the profile's existing role rather than overwriting it with a guess), BUT it
// returns ROLE.VIEWER — not null — for an account that simply belongs to no group. An
// admin-created `external` user belongs to no group by definition, so calling this directly
// for one would demote them to `viewer` and hand them the whole organisation's data. Skipping
// external profiles is exactly what reconcileProfileRole() exists to do.
export async function resolveUserRole(email: string): Promise<Role | null> {
  const auth = createGoogleAuthClient(DIRECTORY_SCOPES);
  if (!auth) return null;

  const groupRoleMap = getGroupRoleMap();
  if (!groupRoleMap[ROLE.ADMIN] && !groupRoleMap[ROLE.STANDARD_USER]) return null;

  const directory = google.admin({ version: "directory_v1", auth });

  for (const role of [ROLE.ADMIN, ROLE.STANDARD_USER] as const) {
    const groupEmail = groupRoleMap[role];
    if (!groupEmail) continue;
    if (await isGroupMember(directory, groupEmail, email)) return role;
  }

  return ROLE.VIEWER;
}

async function isGroupMember(
  directory: admin_directory_v1.Admin,
  groupKey: string,
  memberKey: string,
): Promise<boolean> {
  try {
    await directory.members.get({ groupKey, memberKey });
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 404
  );
}
