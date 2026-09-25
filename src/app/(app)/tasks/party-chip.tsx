"use client";

import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getVizColorForId } from "@/constants/chart-colors";
import { cn, initials } from "@/lib/utils";
import type { PartySummary } from "@/lib/party";

interface PartyChipProps {
  party: PartySummary;
  trailing?: ReactNode;
  className?: string;
}

// A named pill for one owner or person involved — the grid's compact form of PartyRow. Same
// avatar/glyph language, so a department reads as a department wherever a party is shown.
export const PartyChip = ({ party, trailing, className }: PartyChipProps) => {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full border bg-card pr-2 pl-0.5 text-xs text-foreground",
        trailing && "pr-0.5",
        className
      )}
      title={party.isExternal ? `${party.name} · External` : party.name}
    >
      <Avatar size="sm" className="size-5 shrink-0">
        {party.kind === "user" ? <AvatarImage src={party.avatarUrl ?? undefined} alt="" /> : null}
        <AvatarFallback className="text-[10px] text-white" style={{ backgroundColor: getVizColorForId(party.id) }}>
          {party.kind === "department" ? <Building2 className="size-3" /> : initials(party.name, party.name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{party.name}</span>
      {trailing}
    </span>
  );
};
