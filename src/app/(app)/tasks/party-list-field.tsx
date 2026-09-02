"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PartySearchDropdown } from "@/app/(app)/tasks/party-search-dropdown";
import { PartyRow } from "@/app/(app)/tasks/party-row";
import type { PartySummary } from "@/lib/party";

interface PartyListFieldProps {
  parties: PartySummary[];
  onAdd: (party: PartySummary) => void;
  onRemove: (party: PartySummary) => void;
  disabled?: boolean;
  emptyLabel: string;
  placeholder?: string;
  // Collapses the list to this many rows behind a "Show all N" toggle — for the Task Details
  // drawer, which shouldn't grow unbounded. Omit to always show everyone.
  maxVisible?: number;
}

// Controlled add/remove list of parties, shared by Owners and People Involved in both the
// create form (buffered locally) and the detail drawer (server-backed). The two fields differ
// only in their label and empty text, so they're one component, not two.
export const PartyListField = ({
  parties,
  onAdd,
  onRemove,
  disabled,
  emptyLabel,
  placeholder,
  maxVisible,
}: PartyListFieldProps) => {
  const [showAll, setShowAll] = useState(false);
  const isCollapsed = !!maxVisible && !showAll && parties.length > maxVisible;
  const visibleParties = isCollapsed ? parties.slice(0, maxVisible) : parties;

  return (
    <div className="flex flex-col gap-2.5">
      {parties.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border">
          {visibleParties.map((party) => (
            <PartyRow
              key={party.key}
              party={party}
              className="px-3 py-2"
              trailing={
                disabled ? undefined : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(party)}>
                    Remove
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}
      {isCollapsed ? (
        <Button type="button" variant="link" size="sm" className="h-auto self-start p-0" onClick={() => setShowAll(true)}>
          Show all {parties.length}
        </Button>
      ) : null}
      {disabled ? null : (
        <PartySearchDropdown
          excludeKeys={parties.map((party) => party.key)}
          onAdd={onAdd}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};
