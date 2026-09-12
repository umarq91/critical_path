import {
  LayoutDashboard,
  ListTodo,
  ListChecks,
  Calendar,
  GanttChartSquare,
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
      { title: "Tasks", href: "/tasks", icon: ListChecks },
      { title: "Calendar", href: "/calendar", icon: Calendar },
      { title: "Timeline", href: "/timeline", icon: GanttChartSquare },
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
