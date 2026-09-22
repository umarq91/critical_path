"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FilterSelect, type FilterSelectOption } from "@/components/shared/filter-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listMyReminderCandidateTasks } from "@/app/(app)/settings/notifications/_reminder-actions";
import { formatDate } from "@/lib/dates";
import type { ReminderRuleTask } from "@/data/reminders";

const SEARCH_DEBOUNCE_MS = 300;
/** Bounded fetch — a personally-scoped candidate list (see listMyReminderCandidateTasks) is
 *  already small, so one page is enough for a picker. Also the ceiling "Select all" applies
 *  to: it only ever acts on tasks actually loaded into `candidates`. */
const CANDIDATE_PAGE_SIZE = 100;

interface NotifyTaskPickerDialogProps {
  seasonOptions: FilterSelectOption[];
  ownerOptions: FilterSelectOption[];
  brandOptions: FilterSelectOption[];
  genderOptions: FilterSelectOption[];
  selectedIds: ReadonlySet<string>;
  onToggle: (task: ReminderRuleTask) => void;
  /** Selects every currently-loaded/filtered candidate at once — not the user's whole task
   *  list, just what's on screen, so it composes with the search/season/owner filters above. */
  onSelectAll: (tasks: ReminderRuleTask[]) => void;
  /** Clears the entire selection, not just what's currently visible — mirrors what "Save"
   *  would otherwise persist, so it's an honest "start over," not a scoped removal. */
  onClearAll: () => void;
}

// The task list inside "Select tasks..." — scoped to tasks the signed-in user created, owns, or
// is involved in, same set and same due-date-agnostic scope as the My Tasks table above it (see
// listMyReminderCandidateTasks). A task with no due date, or one already overdue, can still be
// picked; it just never actually fires a reminder (listDueReminders skips anything without a
// due_date). Season/owner/brand/gender filters narrow the candidate list down further. Checking a row
// reports it straight to the parent card's selection state; there's no separate "confirm" step,
// since nothing is written to the server until that card's own Save button is pressed.
// `forKey` is the filter combination the results actually answer — "still loading" is derived
// by comparing it to the CURRENT filters, rather than a separately-set flag, so the effect body
// never needs a synchronous setState of its own (only its eventual .then() does). Same
// technique as party-search-dropdown.tsx's SearchState.
type CandidateState =
  | { status: "pending" }
  | { status: "ready"; forKey: string; tasks: ReminderRuleTask[] };

export function NotifyTaskPickerDialog({
  seasonOptions,
  ownerOptions,
  brandOptions,
  genderOptions,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: NotifyTaskPickerDialogProps) {
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [state, setState] = useState<CandidateState>({ status: "pending" });

  const filterKey = JSON.stringify({ seasonId, owner, brandId, gender, debouncedSearch });

  useEffect(() => {
    let cancelled = false;

    const filters: Record<string, string> = {};
    if (seasonId) filters.season_id = seasonId;
    if (owner) filters.owner = owner;
    if (brandId) filters.brand_id = brandId;
    if (gender) filters.gender = gender;
    if (debouncedSearch) filters.search = debouncedSearch;

    listMyReminderCandidateTasks({ filters, pageSize: CANDIDATE_PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      const tasks = result.ok
        ? result.data.map((task) => ({
            id: task.id,
            task_name: task.task_name,
            due_date: task.due_date ?? "",
            season_name: task.season?.season_name ?? null,
          }))
        : [];
      setState({ status: "ready", forKey: filterKey, tasks });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const isLoading = state.status === "pending" || state.forKey !== filterKey;
  const candidates = state.status === "ready" ? state.tasks : [];
  const allVisibleSelected = candidates.length > 0 && candidates.every((task) => selectedIds.has(task.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search my tasks..."
            className="h-8 w-56 pl-8"
          />
        </div>
        <FilterSelect value={seasonId} onValueChange={setSeasonId} options={seasonOptions} allLabel="All seasons" />
        <FilterSelect value={owner} onValueChange={setOwner} options={ownerOptions} allLabel="All owners" />
        <FilterSelect value={brandId} onValueChange={setBrandId} options={brandOptions} allLabel="All brands" />
        <FilterSelect value={gender} onValueChange={setGender} options={genderOptions} allLabel="All genders" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={isLoading || candidates.length === 0 || allVisibleSelected}
            onClick={() => onSelectAll(candidates)}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={selectedIds.size === 0}
            onClick={onClearAll}
          >
            Deselect all
          </Button>
        </div>
      </div>

      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No tasks match — try a different season, owner, brand, gender, or search term.
          </p>
        ) : (
          candidates.map((task) => (
            <label
              key={task.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-sm hover:bg-muted"
            >
              <Checkbox checked={selectedIds.has(task.id)} onCheckedChange={() => onToggle(task)} />
              <span className="min-w-0 flex-1 truncate text-foreground">{task.task_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {task.season_name ? `${task.season_name} · ` : ""}
                {task.due_date ? formatDate(task.due_date) : "No due date"}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
