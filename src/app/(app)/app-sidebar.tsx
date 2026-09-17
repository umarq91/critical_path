"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { navGroupsForRole } from "@/constants/nav";
import type { Role } from "@/constants/roles";

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const navGroups = navGroupsForRole(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 pt-4 pb-2">
        <div className="flex flex-col items-center gap-1 px-2 group-data-[collapsible=icon]:hidden">
          <Image
            src="/icons/logo.jpeg"
            alt="Threebyone"
            width={1600}
            height={328}
            priority
            className="h-10 w-auto object-contain"
          />
          {/* text-overline's size/tracking doubled just for this wordmark, not the shared utility other labels still use.
              #3B3D3F and font-light are a deliberate close match to the logo's own ink and weight, not --foreground.
              font-serif matches the logo's serif typeface (Tailwind's default stack, e.g. Georgia — the app body text stays font-sans). */}
          <span className="text-[22px] font-light uppercase tracking-[0.02em] text-[#3B3D3F] font-serif">Critical Path</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-6 px-1 py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label ?? "root"} className="px-1">
            {group.label ? (
              <SidebarGroupLabel className="text-overline mb-1 px-3">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    (item.activePrefixes ?? []).some(
                      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
                    );
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
