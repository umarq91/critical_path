export const ROUTES = {
  signIn: "/auth/sign-in",
  authCallback: "/auth/callback",
  verifySignIn: "/auth/verify",
  dashboard: "/dashboard",
  tasks: "/tasks",
  myTasks: "/my-tasks",
} as const;

// `/tasks?task=<id>` and `/my-tasks?task=<id>` open that task's detail drawer on load (see
// use-linked-task.ts) — the drawer is otherwise client-only state, so this param is the only way
// to link straight to one task (e.g. from a reminder email, which uses the /my-tasks form).
export const TASK_LINK_PARAM = "task";

// `/tasks?view=<id>` marks which saved view the grid was opened from, so the Views menu can name
// it and offer to overwrite it once the filters drift. Display-only: listTasks never reads it.
export const SAVED_VIEW_PARAM = "view";

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
