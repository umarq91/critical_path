"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterSelect, type FilterSelectOption } from "@/components/shared/filter-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { listMyReminderCandidateTasks } from "@/app/(app)/upcoming/_reminder-actions";
import { formatDate } from "@/lib/dates";
import type { ReminderRuleTask } from "@/data/reminders";

const SEARCH_DEBOUNCE_MS = 300;
/** Bounded fetch — "my" upcoming tasks is already a small, personally-scoped list (see
 *  data/tasks.ts's listUpcomingTasksForProfile), so one page is enough for a picker. */
const CANDIDATE_PAGE_SIZE = 100;

interface NotifyTaskPickerDialogProps {
  seasonOptions: FilterSelectOption[];
  ownerOptions: FilterSelectOption[];
  selectedIds: ReadonlySet<string>;
  onToggle: (task: ReminderRuleTask) => void;
}

// The task list inside "Select tasks..." — scoped to the exact same set the Upcoming Tasks
// table above it shows (tasks the signed-in user created, owns, or is involved in), with
// season/owner filters narrowing it down. Checking a row reports it straight to the parent
// card's selection state; there's no separate "confirm" step, since nothing is written to the
// server until that card's own Save button is pressed.
// `forKey` is the filter combination the results actually answer — "still loading" is derived
// by comparing it to the CURRENT filters, rather than a separately-set flag, so the effect body
// never needs a synchronous setState of its own (only its eventual .then() does). Same
// technique as party-search-dropdown.tsx's SearchState.
type CandidateState =
  | { status: "pending" }
  | { status: "ready"; forKey: string; tasks: ReminderRuleTask[] };

export function NotifyTaskPickerDialog({ seasonOptions, ownerOptions, selectedIds, onToggle }: NotifyTaskPickerDialogProps) {
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [state, setState] = useState<CandidateState>({ status: "pending" });

  const filterKey = JSON.stringify({ seasonId, owner, debouncedSearch });

  useEffect(() => {
    let cancelled = false;

    const filters: Record<string, string> = {};
    if (seasonId) filters.season_id = seasonId;
    if (owner) filters.owner = owner;
    if (debouncedSearch) filters.search = debouncedSearch;

    listMyReminderCandidateTasks({ filters, pageSize: CANDIDATE_PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      const tasks = result.ok
        ? result.data
            .filter((task) => !!task.due_date)
            .map((task) => ({
              id: task.id,
              task_name: task.task_name,
              due_date: task.due_date!,
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
      </div>

      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No upcoming tasks match — try a different season, owner, or search term.
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
                {formatDate(task.due_date)}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
