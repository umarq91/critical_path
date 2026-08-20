"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getVizColorForId } from "@/constants/chart-colors";
import { initials } from "@/lib/utils";

// Shared shape between search results (data/profiles.ts's searchProfiles) and already-linked
// people (data/tasks.ts's listTasks "people" join) — both select the same columns, so one
// row component and one type cover the search dropdown and the added-people list.
export interface PersonSummary {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  department: { name: string } | null;
}

interface PersonRowProps {
  person: PersonSummary;
  trailing?: ReactNode;
  className?: string;
}

export const PersonRow = ({ person, trailing, className }: PersonRowProps) => {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <Avatar size="sm" className="shrink-0">
          <AvatarImage src={person.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(person.id) }}>
            {initials(person.full_name, person.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{person.full_name ?? person.email}</span>
          <span className="truncate text-xs text-muted-foreground">
            {person.email}
            {person.department ? ` · ${person.department.name}` : ""}
          </span>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
};
