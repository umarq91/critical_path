"use client";

import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getVizColorForId } from "@/constants/chart-colors";
import { initials } from "@/lib/utils";
import type { PartySummary } from "@/lib/party";

interface PartyRowProps {
  party: PartySummary;
  trailing?: ReactNode;
  className?: string;
}

// One row shape for both halves of a party picker — search results (data/parties.ts's
// searchParties) and already-picked parties — across Owners and People Involved alike. A
// department renders a building glyph where a person renders their avatar; everything else is
// identical, so there's no second row component.
export const PartyRow = ({ party, trailing, className }: PartyRowProps) => {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <Avatar size="sm" className="shrink-0">
          {party.kind === "user" ? <AvatarImage src={party.avatarUrl ?? undefined} alt="" /> : null}
          <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(party.id) }}>
            {party.kind === "department" ? <Building2 className="size-3.5" /> : initials(party.name, party.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            {party.name}
            {party.isExternal ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                External
              </Badge>
            ) : null}
          </span>
          {party.subtitle ? <span className="truncate text-xs text-muted-foreground">{party.subtitle}</span> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </div>
  );
};
