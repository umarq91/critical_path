"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CriticalPathTab = "board" | "dpsp-flywheel" | "timeline";

const TABS: { id: CriticalPathTab; label: string; href: string }[] = [
  { id: "board", label: "Board", href: "/tasks" },
  { id: "dpsp-flywheel", label: "DPSP Flywheel", href: "/dpsp-flywheel" },
  { id: "timeline", label: "Timeline", href: "/timeline" },
];

// Tasks (Board), DPSP Flywheel and Timeline are three different lenses over the same
// underlying task data — this tab strip is what ties them together as one "Critical Path"
// section instead of three unrelated sidebar links. Each tab is a real route with its own
// query state/toolbar (unlike @tanstack tabs, nothing here is shared client state), so this
// component is deliberately just navigation: active-tab styling off the current route, no
// fetching, no context.
export function CriticalPathTabs({ active }: { active: CriticalPathTab }) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-6">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            tab.id === active
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
