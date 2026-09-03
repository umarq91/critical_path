export const ROLE = {
  ADMIN: "admin",
  STANDARD_USER: "standard_user",
  VIEWER: "viewer",
  EXTERNAL: "external",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  [ROLE.ADMIN]: "Administrator",
  [ROLE.STANDARD_USER]: "Standard User",
  [ROLE.VIEWER]: "Viewer",
  [ROLE.EXTERNAL]: "External",
};

// Roles an admin may pick for a Google Workspace account. `external` is absent on purpose:
// the role and the authentication method are one decision, not two — an external user signs
// in with a password and has no Workspace identity, so switching an account between this set
// and `external` would leave it unable to sign in at all. See management/users/_actions.ts.
export const WORKSPACE_ROLES = [ROLE.ADMIN, ROLE.STANDARD_USER, ROLE.VIEWER] as const;

export function isExternalRole(role: Role): boolean {
  return role === ROLE.EXTERNAL;
}
