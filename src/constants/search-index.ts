import {
  LayoutDashboard,
  ListTodo,
  Workflow,
  GitBranch,
  GanttChartSquare,
  Calendar,
  Tag,
  Leaf,
  Milestone,
  Link2,
  ScrollText,
  User,
  Building2,
  Bell,
  Settings,
  Trash2,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { can, type Action } from "@/lib/permissions";
import type { Role } from "@/constants/roles";

export interface SearchItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  section: string;
  /** Extra words the query can match, beyond title/description — synonyms, abbreviations, and
   *  words for what a page is FOR rather than what it's titled (e.g. "gantt"/"roadmap" for
   *  Timeline, "kanban" for DPSP Flywheel). This is the whole point of the index: a search
   *  shouldn't require knowing the exact page name. */
  keywords: string[];
  requiredAction?: Action;
}

// One flat, searchable index of every real destination in the app — a superset of
// constants/nav.ts (which only carries what the sidebar needs: title/href/icon/requiredAction).
// Kept as its own hand-maintained list rather than derived from NAV_GROUPS, since DPSP Flywheel
// and Timeline are real routes worth jumping straight to from search even though they're tabs
// of the Tasks section, not their own sidebar entries. Add a page here when it's added to
// nav.ts (or to nav.ts and here, for a tab-only route).
export const SEARCH_INDEX: SearchItem[] = [
  {
    title: "Dashboard",
    description: "Charts and completion stats across every task",
    href: "/dashboard",
    icon: LayoutDashboard,
    section: "Pages",
    keywords: ["home", "overview", "charts", "stats", "statistics", "analytics", "reports", "summary"],
  },
  {
    title: "My Tasks",
    description: "Tasks you created, own, or are involved in",
    href: "/my-tasks",
    icon: ListTodo,
    section: "Pages",
    keywords: ["personal", "assigned to me", "mine", "own tasks", "involved"],
  },
  {
    title: "Tasks",
    description: "The full task grid — spreadsheet view of every task",
    href: "/tasks",
    icon: Workflow,
    section: "Pages",
    keywords: ["board", "grid", "spreadsheet", "critical path", "all tasks", "list", "table"],
  },
  {
    title: "DPSP Flywheel",
    description: "Tasks grouped by Demand, Product, Sales, and Profit",
    href: "/dpsp-flywheel",
    icon: GitBranch,
    section: "Pages",
    keywords: ["kanban", "demand", "product", "sales", "profit", "flywheel", "columns", "workflow"],
  },
  {
    title: "Timeline",
    description: "Gantt-style view of tasks by key stage",
    href: "/timeline",
    icon: GanttChartSquare,
    section: "Pages",
    keywords: ["gantt", "roadmap", "schedule", "chart", "key stage"],
  },
  {
    title: "Trash",
    description: "Deleted tasks — restore one at any time",
    href: "/tasks/trash",
    icon: Trash2,
    section: "Pages",
    keywords: ["deleted", "restore", "recover", "undo delete", "recycle bin"],
    requiredAction: "task.delete",
  },
  {
    title: "Calendar",
    description: "Month view of task due dates",
    href: "/calendar",
    icon: Calendar,
    section: "Pages",
    keywords: ["month", "due dates", "schedule", "google calendar", "sync"],
  },
  {
    title: "Brands",
    description: "Manage the brand list",
    href: "/brands",
    icon: Tag,
    section: "Pages",
    keywords: ["labels", "clients", "product lines"],
    requiredAction: "brand.view",
  },
  {
    title: "Seasons",
    description: "Manage seasons and campaigns",
    href: "/seasons",
    icon: Leaf,
    section: "Pages",
    keywords: ["campaigns", "collections", "drops"],
    requiredAction: "lookups.view",
  },
  {
    title: "Key Stages",
    description: "Manage the key stage lookup list",
    href: "/key-stages",
    icon: Milestone,
    section: "Pages",
    keywords: ["milestones", "stages", "phases"],
    requiredAction: "lookups.view",
  },
  {
    title: "External Links",
    description: "Shared bookmarks and resources",
    href: "/external-links",
    icon: Link2,
    section: "Pages",
    keywords: ["bookmarks", "resources", "sales toolkit", "urls", "websites"],
    requiredAction: "lookups.view",
  },
  {
    title: "Users",
    description: "Every account — roles, departments, activation",
    href: "/management/users",
    icon: User,
    section: "Management",
    keywords: [
      "accounts", "staff", "people", "roles", "permissions", "invite",
      "deactivate", "external user", "password", "create user",
    ],
    requiredAction: "admin.manage_users",
  },
  {
    title: "Teams / Departments",
    description: "Department list and membership",
    href: "/management/teams",
    icon: Building2,
    section: "Management",
    keywords: ["department", "org chart", "groups", "members", "teams"],
    requiredAction: "admin.manage_lookups",
  },
  {
    title: "Logs",
    description: "Audit log of every change across the platform",
    href: "/management/logs",
    icon: ScrollText,
    section: "Management",
    keywords: ["audit", "activity", "history", "who changed", "changes", "audit log"],
    requiredAction: "admin.view_audit_log",
  },
  {
    title: "Integrations",
    description: "API keys for the read-only integration API",
    href: "/management/integrations",
    icon: KeyRound,
    section: "Management",
    keywords: ["api key", "api keys", "databricks", "kong", "integration api", "token", "developer"],
    requiredAction: "admin.manage_integrations",
  },
  {
    title: "Email notifications",
    description: "Your own task reminder email settings",
    href: "/settings/notifications",
    icon: Bell,
    section: "Settings",
    keywords: ["reminders", "email", "notify me", "alerts", "notifications", "when am i notified"],
  },
  {
    title: "General Settings",
    description: "Your name, email, role, and department",
    href: "/settings/general",
    icon: Settings,
    section: "Settings",
    keywords: ["profile", "account", "my name", "my email", "my role", "department", "change name"],
  },
];

export function searchItemsForRole(role: Role): SearchItem[] {
  return SEARCH_INDEX.filter((item) => !item.requiredAction || can(role, item.requiredAction));
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

// Every word in the query must appear SOMEWHERE across an item's title/description/section/
// keywords — not a strict phrase match, so "csv import" and "import csv" find the same item,
// and one word ("gantt") is enough on its own. Ranked so a title match always beats a
// keyword-only match, and a title-prefix match beats a mid-string one.
export function matchSearchItems(items: SearchItem[], query: string): SearchItem[] {
  const trimmed = normalise(query);
  if (!trimmed) return items;

  const words = trimmed.split(/\s+/);
  const scored: { item: SearchItem; rank: number }[] = [];

  for (const item of items) {
    const title = normalise(item.title);
    const haystack = normalise([item.title, item.description, item.section, ...item.keywords].join(" "));
    if (!words.every((word) => haystack.includes(word))) continue;

    const rank = title.startsWith(trimmed) ? 0 : title.includes(trimmed) ? 1 : 2;
    scored.push({ item, rank });
  }

  return scored.sort((a, b) => a.rank - b.rank).map((entry) => entry.item);
}
