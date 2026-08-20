"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PeopleSearchDropdown } from "@/app/(app)/tasks/people-search-dropdown";
import { PersonRow, type PersonSummary } from "@/app/(app)/tasks/person-row";

interface PeopleInvolvedFieldProps {
  people: PersonSummary[];
  onAdd: (person: PersonSummary) => void;
  onRemove: (person: PersonSummary) => void;
  disabled?: boolean;
  // Collapses the added-people list to this many rows behind a "Show all N people" toggle —
  // for the Task Details drawer, which shouldn't grow unbounded (spec: "don't let the section
  // become excessively tall"). Omit for the create-task form, which shows everyone.
  maxVisible?: number;
}

export const PeopleInvolvedField = ({ people, onAdd, onRemove, disabled, maxVisible }: PeopleInvolvedFieldProps) => {
  const [showAll, setShowAll] = useState(false);
  const isCollapsed = !!maxVisible && !showAll && people.length > maxVisible;
  const visiblePeople = isCollapsed ? people.slice(0, maxVisible) : people;

  return (
    <div className="flex flex-col gap-2.5">
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No people involved yet</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border">
          {visiblePeople.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              className="px-3 py-2"
              trailing={
                disabled ? undefined : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(person)}>
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
          Show all {people.length} people
        </Button>
      ) : null}
      {disabled ? null : (
        <PeopleSearchDropdown excludeIds={people.map((person) => person.id)} onAdd={onAdd} />
      )}
    </div>
  );
};
