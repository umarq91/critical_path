export const ROLE = {
  ADMIN: "admin",
  STANDARD_USER: "standard_user",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  [ROLE.ADMIN]: "Administrator",
  [ROLE.STANDARD_USER]: "Standard User",
  [ROLE.VIEWER]: "Viewer",
};
