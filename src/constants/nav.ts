import {
  LayoutDashboard,
  ListTodo,
  Workflow,
  Recycle,
  Timeline,
  Calendar,
  CalendarDays,
  Tag,
  Leaf,
  Milestone,
  Link2,
  ScrollText,
  User,
  Building2,
  Bell,
  Settings,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { can, type Action } from "@/lib/permissions";
import type { Role } from "@/constants/roles";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Capability required to see this link. Omitted means every signed-in role sees it.
   *  Hiding a link is presentation only — the page itself guards with requirePageAccess(). */
  requiredAction?: Action;
  /** Extra route prefixes that should also highlight this link, for a section whose sidebar
   *  entry points at one default sub-route but should stay highlighted on others too. Unused
   *  as of Tasks/DPSP Flywheel/Timeline splitting into their own top-level entries below —
   *  kept for the next section that needs it. */
  activePrefixes?: string[];
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

// Single source of truth for the sidebar — src/app/(app)/app-sidebar.tsx renders this,
// nothing else hardcodes nav items. Add a page by adding a row here.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      // DPSP Flywheel and Timeline are two more lenses over the same task data as Tasks
      // (Board) — each is its own route with its own query state/filters/fetch, not shared
      // client state. They used to be reachable only via a shared tab strip on top of one
      // collapsed "Tasks" sidebar entry (components/shared/critical-path-tabs.tsx, since
      // removed) — now each gets a direct entry instead.
      { title: "DPSP Flywheel", href: "/dpsp-flywheel", icon: Recycle },
      { title: "Timeline", href: "/timeline", icon: Timeline },
      { title: "My Tasks", href: "/my-tasks", icon: ListTodo },
      { title: "Tasks", href: "/tasks", icon: Workflow },
      { title: "Calendar", href: "/calendar", icon: Calendar },
      { title: "Brands", href: "/brands", icon: Tag, requiredAction: "brand.view" },
      { title: "Seasons", href: "/seasons", icon: Leaf, requiredAction: "lookups.view" },
      { title: "Key Stages", href: "/key-stages", icon: Milestone, requiredAction: "lookups.view" },
      { title: "Holidays", href: "/holidays", icon: CalendarDays, requiredAction: "lookups.view" },
      { title: "External Links", href: "/external-links", icon: Link2, requiredAction: "lookups.view" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Users", href: "/management/users", icon: User, requiredAction: "admin.manage_users" },
      { title: "Teams / Departments", href: "/management/teams", icon: Building2, requiredAction: "admin.manage_lookups" },
      { title: "Logs", href: "/management/logs", icon: ScrollText, requiredAction: "admin.view_audit_log" },
      { title: "Integrations", href: "/management/integrations", icon: KeyRound, requiredAction: "admin.manage_integrations" },
    ],
  },
  {
    label: "Settings",
    items: [
      // No requiredAction on either of these — reminders and the profile page below are both
      // "manage your own settings" (profile.update_own, granted to every role), not an admin
      // lookup like the rest of Settings.
      { title: "Email notifications", href: "/settings/notifications", icon: Bell },
      { title: "General Settings", href: "/settings/general", icon: Settings },
    ],
  },
];

// Groups whose every item is hidden are dropped entirely, so a role never sees an empty
// "Management" heading with nothing under it.
export function navGroupsForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requiredAction || can(role, item.requiredAction)),
  })).filter((group) => group.items.length > 0);
}
