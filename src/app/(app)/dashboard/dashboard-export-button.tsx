"use client";

import { format } from "date-fns";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { downloadCsv, toCsv, type CsvRow } from "@/lib/csv";
import { formatPercent, percentOf, toGenderGroups } from "@/app/(app)/dashboard/metrics-projection";
import type { DashboardMetrics } from "@/data/dashboard";

function summaryRows(metrics: DashboardMetrics): CsvRow[] {
  const share = (count: number) => formatPercent(percentOf(count, metrics.total));

  return [
    ["Overall", "All tasks", metrics.total, "100.0%"],
    ...Object.entries(metrics.statusCounts).map(([status, count]): CsvRow => [
      "Status",
      TASK_STATUS_CONFIG[status]?.label ?? status,
      count,
      share(count),
    ]),
    ...metrics.bySeason.map((group): CsvRow => ["Season", group.label, group.total, share(group.total)]),
    ...metrics.byBrand.map((group): CsvRow => ["Brand", group.label, group.total, share(group.total)]),
    ...toGenderGroups(metrics.byGender).map((group): CsvRow => [
      "Gender",
      group.label,
      group.total,
      share(group.total),
    ]),
    ...metrics.monthly.map((bucket): CsvRow => [
      "Month",
      bucket.fullLabel,
      bucket.completed,
      formatPercent(percentOf(bucket.completed, bucket.total)),
    ]),
  ];
}

// Exports what the page is already showing, straight from the data it was rendered with — no
// second fetch, no export Route Handler. A binary Excel/PDF export would need one (Server
// Actions can't return a file); CSV of an in-memory summary doesn't.
//
// Deliberately the FULL breakdowns, not the charts' trimmed views: the cards fold their tail
// into "Other" to stay readable, but a spreadsheet has no such limit and every season/brand
// belongs in it.
export const DashboardExportButton = ({ metrics }: { metrics: DashboardMetrics }) => {
  const handleExport = () => {
    downloadCsv(
      `dashboard-summary-${format(new Date(), "yyyy-MM-dd")}.csv`,
      toCsv(["Dimension", "Label", "Tasks", "Share"], summaryRows(metrics))
    );
    toast.success("Dashboard summary exported");
  };

  return (
    <Button onClick={handleExport} disabled={metrics.total === 0}>
      <Download />
      Export
    </Button>
  );
};
