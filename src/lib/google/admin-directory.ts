import "server-only";
import { google, type admin_directory_v1 } from "googleapis";
import { createGoogleAuthClient } from "@/lib/google/auth";
import { ROLE, type Role } from "@/constants/roles";
import { getGroupRoleMap } from "@/constants/google-groups";

const DIRECTORY_SCOPES = ["https://www.googleapis.com/auth/admin.directory.group.readonly"];

// Called from the OAuth callback (immediate) and the nightly group-sync cron (safety net
// for users who don't log in often). Returns null when the service account isn't
// configured, or when no GOOGLE_GROUP_*_EMAIL is set — callers keep the profile's
// existing role in that case rather than overwriting it with a guess.
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
