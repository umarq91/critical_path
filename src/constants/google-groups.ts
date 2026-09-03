import { ROLE, type Role } from "@/constants/roles";

// Group → role mapping, sourced from env because the client's actual Workspace group
// addresses are still to be confirmed (see plan.md §2). Until GOOGLE_GROUP_ADMIN_EMAIL /
// GOOGLE_GROUP_STANDARD_USER_EMAIL are set, resolveUserRole() has nothing to check membership
// against and every user keeps the profiles table's default role.
export function getGroupRoleMap(): Record<Role, string | undefined> {
  return {
    [ROLE.ADMIN]: process.env.GOOGLE_GROUP_ADMIN_EMAIL,
    [ROLE.STANDARD_USER]: process.env.GOOGLE_GROUP_STANDARD_USER_EMAIL,
    [ROLE.VIEWER]: undefined,
    // Never mapped to a Google Group, and this must stay undefined. External users are
    // platform-managed: they have no Workspace identity to be a member of anything, and
    // reconcileProfileRole() skips them entirely (lib/google/role-sync.ts).
    [ROLE.EXTERNAL]: undefined,
  };
}
