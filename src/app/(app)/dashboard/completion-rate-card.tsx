"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { ChartSeriesLegend } from "@/components/charts/chart-series-legend";
import { DonutChart } from "@/components/charts/donut-chart";
import { TASK_STATUS_VIZ_COLORS, VIZ_TRACK_COLOR } from "@/constants/chart-colors";
import { formatPercent, percentOf } from "@/app/(app)/dashboard/metrics-projection";

interface CompletionRateCardProps {
  completed: number;
  total: number;
  className?: string;
}

// The page's headline number, given a whole card. One measure, no filter — the breakdown cards
// beside it answer "completed by what"; this one only answers "how much".
export const CompletionRateCard = ({ completed, total, className }: CompletionRateCardProps) => {
  const remaining = Math.max(total - completed, 0);
  const rate = percentOf(completed, total);

  return (
    <ChartCard title="Completion Rate" description="Completed against everything else" className={className}>
      <DonutChart
        data={[
          { key: "completed", label: "Completed", value: completed, color: TASK_STATUS_VIZ_COLORS.completed },
          { key: "remaining", label: "Remaining", value: remaining, color: VIZ_TRACK_COLOR },
        ]}
        centerValue={formatPercent(rate)}
        centerLabel="Completed"
        className="max-h-[180px]"
      />
      <ChartSeriesLegend
        items={[
          { label: "Completed", color: TASK_STATUS_VIZ_COLORS.completed, value: completed.toLocaleString() },
          { label: "Remaining", color: VIZ_TRACK_COLOR, value: remaining.toLocaleString() },
        ]}
        layout="stacked"
      />
    </ChartCard>
  );
};
