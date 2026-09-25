"use client";

import { Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PartyChip } from "@/app/(app)/tasks/party-chip";
import { PartySearchDropdown } from "@/app/(app)/tasks/party-search-dropdown";
import { cn } from "@/lib/utils";
import type { PartySummary } from "@/lib/party";

interface PartyCellEditorProps {
  parties: PartySummary[];
  onAdd: (party: PartySummary) => void;
  onRemove: (party: PartySummary) => void;
  /** Label for the search box and the remove buttons — "owner" / "person". */
  noun: string;
  /** Can't remove below this many — Owners requires one, mirroring taskParticipantsSchema. */
  minCount?: number;
  disabled?: boolean;
}

// Owners / People Involved while their row is in pencil/tick edit mode. Every chip is shown
// (wrapping, unlike the read-mode PartyNames' single line) so any one of them can be removed,
// and Add opens the same search the drawer and create form use. Changes are buffered by
// useRowParticipants and only written on the row's tick.
//
// The popover is portalled, but React still bubbles its clicks through the component tree to
// the row — harmless here because the board ignores row clicks on a row that's being edited.
export const PartyCellEditor = ({ parties, onAdd, onRemove, noun, minCount = 0, disabled }: PartyCellEditorProps) => {
  const canRemove = !disabled && parties.length > minCount;

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
      {parties.map((party) => (
        <PartyChip
          key={party.key}
          party={party}
          trailing={
            <button
              type="button"
              aria-label={`Remove ${party.name}`}
              title={canRemove ? `Remove ${party.name}` : `A task needs at least one ${noun}`}
              disabled={!canRemove}
              onClick={() => onRemove(party)}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="size-3" />
            </button>
          }
        />
      ))}
      <Popover>
        <PopoverTrigger
          disabled={disabled}
          className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-6 gap-1 rounded-full px-2 text-xs")}
        >
          <Plus className="size-3" />
          Add
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <PartySearchDropdown
            excludeKeys={parties.map((party) => party.key)}
            onAdd={onAdd}
            placeholder={`Add ${noun}: search departments and people...`}
          />
        </PopoverContent>
      </Popover>
      {parties.length === 0 ? <span className="text-xs text-muted-foreground">None yet</span> : null}
    </div>
  );
};
