import {
  LayoutDashboard,
  ListTodo,
  ListChecks,
  Calendar,
  Tag,
  Leaf,
  FileBarChart2,
  User,
  Users,
  ShieldCheck,
  Bell,
  Puzzle,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
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
      { title: "Brands", href: "/brands", icon: Tag },
      { title: "Seasons", href: "/seasons", icon: Leaf },
      { title: "Reports", href: "/reports", icon: FileBarChart2 },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Users", href: "/management/users", icon: User },
      { title: "Teams", href: "/management/teams", icon: Users },
      { title: "Roles & Permissions", href: "/management/roles", icon: ShieldCheck },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Notifications", href: "/settings/notifications", icon: Bell },
      { title: "Integrations", href: "/settings/integrations", icon: Puzzle },
      { title: "General Settings", href: "/settings/general", icon: Settings },
    ],
  },
];
