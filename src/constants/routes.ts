export const ROUTES = {
  signIn: "/auth/sign-in",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
} as const;

// Checked by src/proxy.ts — any request under these prefixes requires a session.
// Kept as the full set of (app) route-group modules (see CLAUDE.md file tree) so proxy.ts
// doesn't need editing every time a new module lands — only pages that exist yet resolve,
// the rest 404 normally past the auth check.
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tasks",
  "/calendar",
  "/timeline",
  "/upcoming",
  "/sales-toolkit",
  "/admin",
] as const;

// Checked by src/app/(app)/admin/layout.tsx — requires role === ROLE.ADMIN in addition
// to being authenticated.
export const ADMIN_PREFIXES = ["/admin"] as const;
