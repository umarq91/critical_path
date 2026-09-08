"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setTaskParticipants } from "@/app/(app)/tasks/_participant-actions";
import type { PartySummary } from "@/lib/party";

// Owners + People Involved as ONE buffered edit, confirmed with Save. Adds and removes change
// local state only; nothing reaches the database until save(), which writes both roles in a
// single call and therefore produces a single audit-log entry. The drawer used to write on
// every click, which meant one editing session left a scattering of log rows.
//
// Baselines live in state (not props) so a successful save re-bases them without a remount —
// otherwise the bar would stay "unsaved" after saving, or reset to the pre-save list when the
// board refreshes underneath it.
export function useParticipantsDraft(
  taskId: string,
  initialOwners: PartySummary[],
  initialPeople: PartySummary[],
  onSaved?: () => void
) {
  const [baseline, setBaseline] = useState({ owners: initialOwners, people: initialPeople });
  const [owners, setOwners] = useState(initialOwners);
  const [people, setPeople] = useState(initialPeople);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = !isSameSet(owners, baseline.owners) || !isSameSet(people, baseline.people);

  function addTo(setList: typeof setOwners) {
    return (party: PartySummary) =>
      setList((prev) => (prev.some((existing) => existing.key === party.key) ? prev : [...prev, party]));
  }

  function removeFrom(setList: typeof setOwners) {
    return (party: PartySummary) => setList((prev) => prev.filter((existing) => existing.key !== party.key));
  }

  async function save() {
    // Mirrors taskParticipantsSchema's owners.min(1) — caught here so the message names the
    // rule rather than surfacing as a zod issue after a round trip.
    if (owners.length === 0) {
      toast.error("A task must have at least one owner");
      return;
    }

    setIsSaving(true);
    const result = await setTaskParticipants(taskId, {
      owners: owners.map((party) => party.key),
      people_involved: people.map((party) => party.key),
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setBaseline({ owners, people });
    toast.success("Changes saved");
    onSaved?.();
  }

  function discard() {
    setOwners(baseline.owners);
    setPeople(baseline.people);
  }

  return {
    owners,
    people,
    isDirty,
    isSaving,
    addOwner: addTo(setOwners),
    removeOwner: removeFrom(setOwners),
    addPerson: addTo(setPeople),
    removePerson: removeFrom(setPeople),
    save,
    discard,
  };
}

export type ParticipantsDraft = ReturnType<typeof useParticipantsDraft>;

// Order is presentation, not meaning — a task's owners are a set, so reordering them is not an
// unsaved change.
function isSameSet(a: PartySummary[], b: PartySummary[]) {
  if (a.length !== b.length) return false;
  const keys = new Set(b.map((party) => party.key));
  return a.every((party) => keys.has(party.key));
}
