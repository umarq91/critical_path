import { ROLE, type Role } from "@/constants/roles";

// Single capability matrix — imported by Server Actions (enforcement) and by the UI
// (disable/hide). RLS mirrors these same rules server-side as defense in depth; when this
// matrix changes, update the matching migration in the same PR.
type Action =
  | "profile.update_own"
  | "admin.manage_users"
  | "admin.manage_lookups";

export function can(role: Role, action: Action): boolean {
  if (role === ROLE.ADMIN) return true;

  switch (action) {
    case "profile.update_own":
      return true;
    case "admin.manage_users":
    case "admin.manage_lookups":
      return false;
    default:
      return false;
  }
}

export function isAdmin(role: Role): boolean {
  return role === ROLE.ADMIN;
}
