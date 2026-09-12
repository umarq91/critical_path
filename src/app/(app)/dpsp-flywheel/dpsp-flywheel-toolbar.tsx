"use client";

import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FilterSelect, type FilterSelectOption } from "@/components/shared/filter-select";
import { DPSP_CATEGORY_CONFIG, DPSP_CATEGORY_SOLID_CLASSNAME } from "@/constants/dpsp-category";
import { dpspCategoryValues } from "@/app/(app)/tasks/schema";
import { cn } from "@/lib/utils";
import type { DpspFlywheelQueryState } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-query-state";

interface DpspFlywheelToolbarProps {
  queryState: DpspFlywheelQueryState;
  seasonOptions: FilterSelectOption[];
  departmentOptions: FilterSelectOption[];
  visibleCategories: ReadonlySet<(typeof dpspCategoryValues)[number]>;
  onToggleCategory: (category: (typeof dpspCategoryValues)[number]) => void;
  shownCount: number;
}

// Search + season/department pickers narrow the query itself (see listTasksForFlywheel, same
// filters vocabulary listTasks() takes); the category pills are pure display — which of the
// four columns render — so they're driven by component state (visibleCategories/onToggleCategory)
// from the workspace, not the URL.
export const DpspFlywheelToolbar = ({
  queryState,
  seasonOptions,
  departmentOptions,
  visibleCategories,
  onToggleCategory,
  shownCount,
}: DpspFlywheelToolbarProps) => {
  const { state, setFilters, isPending } = queryState;
  const hasFilters = !!(state.seasonId || state.department || state.q || state.hideDone);

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("flex flex-wrap items-center gap-2 transition-opacity duration-200", isPending && "opacity-60")}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={state.q}
            onChange={(event) => setFilters({ q: event.target.value || null })}
            placeholder="Search tasks, seasons, brands, departments, owners or people..."
            aria-label="Search tasks"
            className="h-8 w-72 pl-8"
          />
          {isPending ? (
            <Loader2 className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <FilterSelect
          value={state.seasonId || null}
          onValueChange={(value) => setFilters({ seasonId: value })}
          options={seasonOptions}
          allLabel="All seasons"
        />
        <FilterSelect
          value={state.department || null}
          onValueChange={(value) => setFilters({ department: value })}
          options={departmentOptions}
          allLabel="All departments"
        />

        <div className="ml-1 flex items-center gap-1.5">
          {dpspCategoryValues.map((category) => {
            const active = visibleCategories.has(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleCategory(category)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? cn(DPSP_CATEGORY_SOLID_CLASSNAME[category], "border-transparent text-white")
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                {DPSP_CATEGORY_CONFIG[category].label}
              </button>
            );
          })}
        </div>

        <label className="ml-1 flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={state.hideDone} onCheckedChange={(checked) => setFilters({ hideDone: checked ? true : null })} />
          <Label className="cursor-pointer font-normal">Hide done</Label>
        </label>

        {hasFilters ? (
          <button
            type="button"
            className="px-1 text-sm text-primary hover:underline"
            onClick={() => setFilters({ seasonId: null, department: null, q: null, hideDone: null })}
          >
            Clear
          </button>
        ) : null}

        <span className="ml-auto text-sm text-muted-foreground">
          {shownCount} {shownCount === 1 ? "task" : "tasks"} shown
        </span>
      </div>
    </div>
  );
};
