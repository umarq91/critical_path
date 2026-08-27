"use client";

import { useMemo, useState } from "react";
import { ChartPie } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { ChartSeriesLegend } from "@/components/charts/chart-series-legend";
import { DonutChart } from "@/components/charts/donut-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  completionRateOf,
  foldTopGroups,
  formatPercent,
  formatShare,
  groupColor,
  scopeGroups,
  toDonutSlices,
  toFilterOptions,
  totalOf,
  type BreakdownGroup,
} from "@/app/(app)/dashboard/metrics-projection";

interface BreakdownDonutCardProps {
  title: string;
  description: string;
  /** The dropdown's "show everything" entry, e.g. "All Seasons". */
  allLabel: string;
  groups: BreakdownGroup[];
  /** Pins the ring-centre rate instead of deriving it from the current scope. The Status card
   *  needs this: "completed" is one of its own slices, so scoping to "Overdue" would otherwise
   *  report a 0% completion rate for the whole business. */
  centerRate?: number;
  className?: string;
}

// Tasks by Season, Task Status Overview and Tasks by Gender are the same card three times over
// — a ring split by one dimension, a scope dropdown, and a completion rate in the middle. Only
// the groups differ, so they're one component with different props rather than three files.
export const BreakdownDonutCard = ({
  title,
  description,
  allLabel,
  groups,
  centerRate,
  className,
}: BreakdownDonutCardProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { slices, legend, scopedTotal, rate } = useMemo(() => {
    const scoped = scopeGroups(groups, selectedId);
    // Folding only makes sense across the whole set — a scoped view is a single group.
    const visible = selectedId ? scoped : foldTopGroups(groups);
    const total = totalOf(visible);

    return {
      slices: toDonutSlices(visible),
      legend: visible.map((group) => ({
        label: group.label,
        color: groupColor(group),
        value: formatShare(group.total, total),
      })),
      scopedTotal: total,
      rate: centerRate ?? completionRateOf(scoped),
    };
  }, [groups, selectedId, centerRate]);

  const action =
    groups.length > 1 ? (
      <FilterSelect
        value={selectedId}
        onValueChange={setSelectedId}
        options={toFilterOptions(groups)}
        allLabel={allLabel}
      />
    ) : null;

  return (
    <ChartCard title={title} description={description} action={action} className={className}>
      {scopedTotal === 0 ? (
        <EmptyState icon={ChartPie} title="No tasks here yet" description="This chart fills in once tasks are created." />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <DonutChart
            data={slices}
            centerValue={formatPercent(rate)}
            centerLabel="Completed"
            className="max-h-[200px] shrink-0 sm:w-[200px]"
          />
          <ChartSeriesLegend items={legend} layout="stacked" className="w-full min-w-0 flex-1" />
        </div>
      )}
    </ChartCard>
  );
};
