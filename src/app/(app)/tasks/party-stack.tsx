"use client";

import { Building2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getVizColorForId } from "@/constants/chart-colors";
import { initials } from "@/lib/utils";
import type { PartySummary } from "@/lib/party";

interface PartyStackProps {
  parties: PartySummary[];
  maxVisible?: number;
  /** Shows the single party's name beside its avatar — for columns wide enough to carry it. */
  showSoleName?: boolean;
}

// Overlapping avatar stack for a task's owners or people involved, in the grid and anywhere
// else a party set has to fit on one line. Departments render a building glyph; people render
// their avatar. Same visual language as PartyRow, minus the two-line layout.
//
// Every avatar carries a tooltip, since the glyph alone doesn't say who it is — that's the only
// way to read a stacked set without opening the task. TooltipProvider is mounted once in the
// root layout, so there's none here.
export const PartyStack = ({ parties, maxVisible = 3, showSoleName }: PartyStackProps) => {
  if (parties.length === 0) return <span className="text-muted-foreground">—</span>;

  const visible = parties.slice(0, maxVisible);
  const overflow = parties.slice(maxVisible);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex shrink-0 items-center -space-x-2">
        {visible.map((party) => (
          <Tooltip key={party.key}>
            <TooltipTrigger render={<span className="inline-flex cursor-default" />}>
              <Avatar size="sm" className="ring-2 ring-card">
                {party.kind === "user" ? <AvatarImage src={party.avatarUrl ?? undefined} alt="" /> : null}
                <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(party.id) }}>
                  {party.kind === "department" ? <Building2 className="size-3.5" /> : initials(party.name, party.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{party.isExternal ? `${party.name} · External` : party.name}</TooltipContent>
          </Tooltip>
        ))}
        {overflow.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card" />
              }
            >
              +{overflow.length}
            </TooltipTrigger>
            <TooltipContent>
              <span className="flex flex-col gap-0.5">
                {overflow.map((party) => (
                  <span key={party.key}>{party.name}</span>
                ))}
              </span>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {showSoleName && parties.length === 1 ? <span className="truncate">{parties[0].name}</span> : null}
    </div>
  );
};
