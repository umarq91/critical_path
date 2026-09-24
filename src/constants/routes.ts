export const ROUTES = {
  signIn: "/auth/sign-in",
  authCallback: "/auth/callback",
  dashboard: "/dashboard",
  tasks: "/tasks",
  myTasks: "/my-tasks",
} as const;

// `/my-tasks?task=<id>` opens that task's detail drawer on load — the drawer is otherwise
// client-only state, so this param is the only way to link straight to one task (e.g. from a
// reminder email).
export const TASK_LINK_PARAM = "task";

// Checked by src/proxy.ts — any request under these prefixes requires a session.
// Kept as the full set of (app) route-group modules (see CLAUDE.md file tree + the
// sidebar nav in src/constants/nav.ts) so proxy.ts doesn't need editing every time a new
// page lands — only pages that exist yet resolve, the rest 404 normally past the auth
// check.
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/my-tasks",
  "/tasks",
  "/calendar",
  "/timeline",
  "/dpsp-flywheel",
  "/brands",
  "/seasons",
  "/key-stages",
  "/external-links",
  "/sales-toolkit",
  "/management",
  "/settings",
] as const;

// Reserved for role-gating once Management/Settings pages need it — not enforced yet,
// see src/app/(app)/layout.tsx.
export const ADMIN_PREFIXES = ["/management", "/settings"] as const;
