"use client";

import { PartyChip } from "@/app/(app)/tasks/party-chip";
import type { PartySummary } from "@/lib/party";

interface PartyNamesProps {
  parties: PartySummary[];
}

// A task's owners or people involved as named chips, wrapping onto further lines rather than
// hiding any behind a "+N more" — the grid's Owner/People columns wrap (meta.wrap), so every
// name is readable without hovering. A single chip still truncates if its name alone is wider
// than the column.
export const PartyNames = ({ parties }: PartyNamesProps) => {
  if (parties.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-0.5">
      {parties.map((party) => (
        <PartyChip key={party.key} party={party} size="sm" />
      ))}
    </div>
  );
};
