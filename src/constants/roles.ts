export const ROLE = {
  ADMIN: "admin",
  MANAGER: "manager",
  VIEWER: "viewer",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  [ROLE.ADMIN]: "Admin",
  [ROLE.MANAGER]: "Manager",
  [ROLE.VIEWER]: "Viewer",
};
