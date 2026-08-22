"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CriticalPathLogo } from "@/components/icons/critical-path-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "@/constants/nav";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 pt-4 pb-2">
        <div className="flex h-10 items-center gap-2 px-2">
          <CriticalPathLogo className="size-6 shrink-0" />
          <span className="text-h3 lg:text-h2 truncate group-data-[collapsible=icon]:hidden">
            Critical Path
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-6 px-1 py-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label ?? "root"} className="px-1">
            {group.label ? (
              <SidebarGroupLabel className="text-overline mb-1 px-3">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        tooltip={item.title}
                        className="gap-3 px-3"
                      >
                        <item.icon />
                        <span className="font-semibold">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
