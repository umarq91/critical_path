"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setTaskParticipants } from "@/app/(app)/tasks/_participant-actions";
import { updateTask } from "@/app/(app)/tasks/_actions";
import type { PartySummary } from "@/lib/party";

interface DrawerBaseline {
  owners: PartySummary[];
  people: PartySummary[];
  isCritical: boolean;
}

// Everything the task drawer lets you change (Owners, People Involved, Critical Task) as ONE
// buffered edit, confirmed with Save. Clicks change local state only; nothing reaches the
// database until save(). Participants go in a single setTaskParticipants call (one audit entry,
// where the drawer used to write on every click), and the Critical flag through updateTask, each
// only if it actually changed.
//
// Baselines live in state (not props) so a successful save re-bases them without a remount —
// otherwise the bar would stay "unsaved" after saving, or reset to the pre-save values when the
// board refreshes underneath it.
export function useTaskDrawerDraft(taskId: string, initial: DrawerBaseline, onSaved?: () => void) {
  const [baseline, setBaseline] = useState(initial);
  const [owners, setOwners] = useState(initial.owners);
  const [people, setPeople] = useState(initial.people);
  const [isCritical, setIsCritical] = useState(initial.isCritical);
  const [isSaving, setIsSaving] = useState(false);

  const participantsChanged = !isSameSet(owners, baseline.owners) || !isSameSet(people, baseline.people);
  const criticalChanged = isCritical !== baseline.isCritical;
  const isDirty = participantsChanged || criticalChanged;

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
    if (participantsChanged && owners.length === 0) {
      toast.error("A task must have at least one owner");
      return;
    }

    setIsSaving(true);
    const results = await Promise.all([
      participantsChanged
        ? setTaskParticipants(taskId, {
            owners: owners.map((party) => party.key),
            people_involved: people.map((party) => party.key),
          })
        : null,
      criticalChanged ? updateTask(taskId, { is_critical: isCritical }) : null,
    ]);
    setIsSaving(false);

    // Re-base whichever half did save, so a partial failure leaves only the failed half pending.
    const [participantsResult, criticalResult] = results;
    setBaseline((current) => ({
      owners: participantsResult?.ok ? owners : current.owners,
      people: participantsResult?.ok ? people : current.people,
      isCritical: criticalResult?.ok ? isCritical : current.isCritical,
    }));
    const failure = results.find((result) => result && !result.ok);
    if (failure && !failure.ok) {
      toast.error(failure.error);
      if (results.some((result) => result?.ok)) onSaved?.();
      return;
    }

    toast.success("Changes saved");
    onSaved?.();
  }

  function discard() {
    setOwners(baseline.owners);
    setPeople(baseline.people);
    setIsCritical(baseline.isCritical);
  }

  return {
    owners,
    people,
    isCritical,
    /** The last saved Critical value — what the header badge shows, not the unsaved checkbox. */
    savedIsCritical: baseline.isCritical,
    isDirty,
    isSaving,
    addOwner: addTo(setOwners),
    removeOwner: removeFrom(setOwners),
    addPerson: addTo(setPeople),
    removePerson: removeFrom(setPeople),
    setIsCritical,
    save,
    discard,
  };
}

export type TaskDrawerDraft = ReturnType<typeof useTaskDrawerDraft>;

// Order is presentation, not meaning — a task's owners are a set, so reordering them is not an
// unsaved change.
export function isSameSet(a: PartySummary[], b: PartySummary[]) {
  if (a.length !== b.length) return false;
  const keys = new Set(b.map((party) => party.key));
  return a.every((party) => keys.has(party.key));
}
