export const ROUTES = {
  signIn: "/auth/sign-in",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
  tasks: "/tasks",
} as const;

// Checked by src/proxy.ts — any request under these prefixes requires a session.
// Kept as the full set of (app) route-group modules (see CLAUDE.md file tree + the
// sidebar nav in src/constants/nav.ts) so proxy.ts doesn't need editing every time a new
// page lands — only pages that exist yet resolve, the rest 404 normally past the auth
// check.
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/upcoming",
  "/tasks",
  "/calendar",
  "/timeline",
  "/brands",
  "/seasons",
  "/key-stages",
  "/reports",
  "/sales-toolkit",
  "/management",
  "/settings",
] as const;

// Reserved for role-gating once Management/Settings pages need it — not enforced yet,
// see src/app/(app)/layout.tsx.
export const ADMIN_PREFIXES = ["/management", "/settings"] as const;
