"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarCheck, CircleCheckBig, TriangleAlert } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { CategoryBarChart, type ChartSeries } from "@/components/charts/category-bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { StatCard } from "@/components/shared/stat-card";
import { TASK_STATUS_VIZ_COLORS } from "@/constants/chart-colors";
import { formatPercent, percentOf } from "@/app/(app)/dashboard/metrics-projection";
import type { CompletionBucket } from "@/data/dashboard";

type Granularity = "monthly" | "weekly";

const GRANULARITY_OPTIONS = [
  { value: "monthly" as const, label: "Monthly" },
  { value: "weekly" as const, label: "Weekly" },
];

const PERIOD_NOUN: Record<Granularity, string> = { monthly: "Month", weekly: "Week" };

const COMPLETED_SERIES: ChartSeries[] = [
  { key: "completed", label: "Completed tasks", color: TASK_STATUS_VIZ_COLORS.completed },
];

interface TaskCompletionCardProps {
  monthly: CompletionBucket[];
  weekly: CompletionBucket[];
  className?: string;
}

export const TaskCompletionCard = ({ monthly, weekly, className }: TaskCompletionCardProps) => {
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  const { rows, averageRate, best, completed, overdue, hasData, window } = useMemo(() => {
    const buckets = granularity === "monthly" ? monthly : weekly;
    // Periods with nothing due carry no completion rate — averaging a 0% into the headline
    // would punish a quiet month rather than describe one.
    const scored = buckets.filter((bucket) => bucket.total > 0);
    const rates = scored.map((bucket) => percentOf(bucket.completed, bucket.total));

    return {
      rows: buckets.map((bucket) => ({ label: bucket.label, values: { completed: bucket.completed } })),
      averageRate: rates.length === 0 ? 0 : rates.reduce((sum, rate) => sum + rate, 0) / rates.length,
      best: scored.reduce<CompletionBucket | null>((leader, bucket) => {
        if (!leader) return bucket;
        return percentOf(bucket.completed, bucket.total) > percentOf(leader.completed, leader.total)
          ? bucket
          : leader;
      }, null),
      completed: buckets.reduce((sum, bucket) => sum + bucket.completed, 0),
      overdue: buckets.reduce((sum, bucket) => sum + bucket.overdue, 0),
      hasData: scored.length > 0,
      // The four tiles count only what falls inside this window, so the window has to be
      // stated — otherwise they read as contradicting the page's all-time header tiles. The
      // weekly axis skips weeks with nothing due, so it says so rather than implying a
      // continuous range.
      window:
        buckets.length === 0
          ? ""
          : `${buckets[0].fullLabel} – ${buckets[buckets.length - 1].fullLabel}${
              granularity === "weekly" ? ", weeks with tasks due" : ""
            }`,
    };
  }, [granularity, monthly, weekly]);

  return (
    <ChartCard
      title="Task Completion"
      description={window ? `${window} — by the period each task is due` : undefined}
      className={className}
      action={
        <SegmentedControl
          value={granularity}
          onValueChange={setGranularity}
          options={GRANULARITY_OPTIONS}
          label="Completion period"
        />
      }
    >
      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing due in this period"
          description="Completion trends appear once tasks have due dates in range."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CategoryBarChart
            rows={rows}
            series={COMPLETED_SERIES}
            orientation="vertical"
            className="h-[280px] lg:col-span-2"
          />
          <div className="flex flex-col gap-3">
            <StatCard
              icon={CalendarCheck}
              iconClassName="bg-primary-tint text-primary"
              label="Average Completion Rate"
              value={formatPercent(averageRate)}
            />
            <StatCard
              icon={BarChart3}
              iconClassName="bg-status-complete-soft text-status-complete-text"
              label={`Best Performing ${PERIOD_NOUN[granularity]}`}
              value={
                best
                  ? `${best.fullLabel} (${formatPercent(percentOf(best.completed, best.total))})`
                  : "—"
              }
            />
            <StatCard
              icon={CircleCheckBig}
              iconClassName="bg-status-complete-soft text-status-complete-text"
              label="Total Completed Tasks"
              value={completed.toLocaleString()}
            />
            <StatCard
              icon={TriangleAlert}
              iconClassName="bg-status-overdue-soft text-status-overdue-text"
              label="Total Overdue Tasks"
              value={overdue.toLocaleString()}
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
};
