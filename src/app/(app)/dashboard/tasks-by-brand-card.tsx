"use client";

import { useMemo, useState } from "react";
import { ChartPie } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { MeterBarList } from "@/components/charts/meter-bar-list";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import {
  formatShare,
  groupColor,
  scopeGroups,
  toFilterOptions,
  totalOf,
} from "@/app/(app)/dashboard/metrics-projection";
import type { TaskBreakdownGroup } from "@/data/dashboard";

interface TasksByBrandCardProps {
  groups: TaskBreakdownGroup[];
  className?: string;
}

// Brands outnumber seasons, so this is a ranked bar list rather than another ring: it stays
// readable at a dozen rows where a donut would already be a colour-matching exercise.
//
// Six rows also lands the card's content height alongside the donut cards sharing its row, so
// the three don't sit at visibly different heights.
const VISIBLE_BRAND_COUNT = 6;

export const TasksByBrandCard = ({ groups, className }: TasksByBrandCardProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => {
    const scoped = scopeGroups(groups, selectedId);
    // Shares stay relative to the whole set, not the visible rows — a brand's "20.8%" means
    // 20.8% of all tasks whether or not the list is currently narrowed to it.
    const total = totalOf(groups);
    const visible = selectedId ? scoped : scoped.slice(0, VISIBLE_BRAND_COUNT);

    return visible.map((group) => ({
      id: group.id,
      label: group.label,
      value: group.total,
      caption: formatShare(group.total, total),
      color: groupColor(group),
    }));
  }, [groups, selectedId]);

  return (
    <ChartCard
      title="Tasks by Brand"
      description="Totals per brand, largest first"
      className={className}
      action={
        groups.length > 1 ? (
          <FilterSelect
            value={selectedId}
            onValueChange={setSelectedId}
            options={toFilterOptions(groups)}
            allLabel="All Brands"
          />
        ) : null
      }
    >
      {items.length === 0 ? (
        <EmptyState icon={ChartPie} title="No tasks here yet" description="This chart fills in once tasks are created." />
      ) : (
        <MeterBarList items={items} />
      )}
    </ChartCard>
  );
};
