import { ROLE, type Role } from "@/constants/roles";

// Group → role mapping, sourced from env because the client's actual Workspace group
// addresses are still to be confirmed (see plan.md §2). Until GOOGLE_GROUP_ADMIN_EMAIL /
// GOOGLE_GROUP_MANAGER_EMAIL are set, resolveUserRole() has nothing to check membership
// against and every user keeps the profiles table's default role.
export function getGroupRoleMap(): Record<Role, string | undefined> {
  return {
    [ROLE.ADMIN]: process.env.GOOGLE_GROUP_ADMIN_EMAIL,
    [ROLE.MANAGER]: process.env.GOOGLE_GROUP_MANAGER_EMAIL,
    [ROLE.VIEWER]: undefined,
  };
}
