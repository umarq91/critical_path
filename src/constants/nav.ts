import {
  LayoutDashboard,
  ListTodo,
  Workflow,
  Calendar,
  Tag,
  Leaf,
  Milestone,
  Link2,
  ScrollText,
  User,
  Building2,
  Bell,
  Puzzle,
  Settings,
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
  /** Extra route prefixes that should also highlight this link — for "Critical Path", whose
   *  href points at /tasks (its default tab) but should stay highlighted on /dpsp-flywheel and
   *  /timeline too, since those are tabs of the same section, not separate pages. */
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
      { title: "Upcoming Tasks", href: "/upcoming", icon: ListTodo },
      // Board (Tasks), DPSP Flywheel and Timeline are one section — three tabs over the same
      // task data (see components/shared/critical-path-tabs.tsx), not three unrelated pages,
      // so they get a single sidebar entry rather than three. Points at /tasks (Board) since
      // that's the section's default landing tab; labelled "Tasks" (not "Critical Path") per
      // client preference, even though the tab strip it lands on is titled Critical Path.
      { title: "Tasks", href: "/tasks", icon: Workflow, activePrefixes: ["/dpsp-flywheel", "/timeline"] },
      { title: "Calendar", href: "/calendar", icon: Calendar },
      { title: "Brands", href: "/brands", icon: Tag, requiredAction: "brand.view" },
      { title: "Seasons", href: "/seasons", icon: Leaf, requiredAction: "lookups.view" },
      { title: "Key Stages", href: "/key-stages", icon: Milestone, requiredAction: "lookups.view" },
      { title: "External Links", href: "/external-links", icon: Link2, requiredAction: "lookups.view" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Users", href: "/management/users", icon: User, requiredAction: "admin.manage_users" },
      { title: "Teams / Departments", href: "/management/teams", icon: Building2, requiredAction: "admin.manage_lookups" },
      { title: "Logs", href: "/management/logs", icon: ScrollText, requiredAction: "admin.view_audit_log" },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Notifications", href: "/settings/notifications", icon: Bell, requiredAction: "admin.manage_lookups" },
      { title: "Integrations", href: "/settings/integrations", icon: Puzzle, requiredAction: "admin.manage_lookups" },
      { title: "General Settings", href: "/settings/general", icon: Settings, requiredAction: "admin.manage_lookups" },
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
