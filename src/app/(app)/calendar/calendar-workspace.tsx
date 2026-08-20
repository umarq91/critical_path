"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CalendarToolbar } from "@/app/(app)/calendar/calendar-toolbar";
import { CalendarBoard } from "@/app/(app)/calendar/calendar-board";
import { useCalendarQueryState } from "@/app/(app)/calendar/calendar-query-state";
import { toQueryDate, type CalendarRange } from "@/app/(app)/calendar/calendar-utils";
import type { CalendarView } from "@/app/(app)/calendar/calendar-search-params";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import type { Task } from "@/data/tasks";

interface CalendarWorkspaceProps {
  view: CalendarView;
  anchorDate: Date;
  range: CalendarRange;
  tasks: Task[];
  canAssignPeople: boolean;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
  statusOptions: DataTableFilterOption[];
}

// Owns the single URL-state hook (view/date/filters) shared by the toolbar's controls and
// the board's pending overlay — see calendar-query-state.ts. Also the one place carrying a
// solid bg-card behind toolbar + grid, so the whole workspace reads as one surface instead
// of transparent content floating over the page background.
export const CalendarWorkspace = ({
  view,
  anchorDate,
  range,
  tasks,
  canAssignPeople,
  seasonOptions,
  brandOptions,
  statusOptions,
}: CalendarWorkspaceProps) => {
  const queryState = useCalendarQueryState();
  const { state, setState } = queryState;
  const hasActiveFilters = !!(state.seasonId || state.brandId || state.status);

  // Clicking a date number or a day's "+N more" overflow both land here — jumping to Day
  // view for that date is the one mechanism that answers "show me everything on this day",
  // so overflow doesn't need its own popover/modal.
  function navigateToDate(date: Date) {
    void setState({ view: "day", date: toQueryDate(date) });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <CalendarToolbar
          queryState={queryState}
          seasonOptions={seasonOptions}
          brandOptions={brandOptions}
          statusOptions={statusOptions}
          taskCount={tasks.length}
        />
        <CalendarBoard
          view={view}
          anchorDate={anchorDate}
          range={range}
          tasks={tasks}
          canAssignPeople={canAssignPeople}
          isPending={queryState.isPending}
          hasActiveFilters={hasActiveFilters}
          onNavigateToDate={navigateToDate}
        />
      </CardContent>
    </Card>
  );
};
