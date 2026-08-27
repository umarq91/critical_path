"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface CategoryBarChartRow {
  label: string;
  values: Record<string, number>;
}

interface CategoryBarChartProps {
  rows: CategoryBarChartRow[];
  /** One entry renders plain bars; more than one stacks them in the given order. */
  series: ChartSeries[];
  /** Direction the bars grow. "horizontal" (default) puts named entities on the long axis;
   *  "vertical" gives columns, for an ordered time axis where left-to-right means later. */
  orientation?: "horizontal" | "vertical";
  /** px reserved for the category axis labels. Horizontal orientation only. */
  categoryWidth?: number;
  className?: string;
}

const MAX_TICK_CHARS = 22;

function truncateTick(value: string) {
  return value.length > MAX_TICK_CHARS ? `${value.slice(0, MAX_TICK_CHARS - 1)}…` : value;
}

// Horizontal bars — categories are named entities (seasons, brands), so the long axis carries
// the labels and stays readable however many rows there are. Single- and multi-series share one
// implementation: a stack of one is just a bar. Passing orientation="vertical" turns the same
// stack into columns for time buckets, where reading order has to be chronological.
export const CategoryBarChart = ({
  rows,
  series,
  orientation = "horizontal",
  categoryWidth = 120,
  className,
}: CategoryBarChartProps) => {
  const config = Object.fromEntries(
    series.map((entry) => [entry.key, { label: entry.label, color: entry.color }])
  ) as ChartConfig;

  const data = rows.map((row) => ({
    label: row.label,
    // Rendered as the direct label at the end of each stack — the mark colours themselves sit
    // below 3:1 against the card surface, so the numbers can't be left to the tooltip alone.
    total: series.reduce((sum, entry) => sum + (row.values[entry.key] ?? 0), 0),
    ...Object.fromEntries(series.map((entry) => [entry.key, row.values[entry.key] ?? 0])),
  }));

  const isColumns = orientation === "vertical";

  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)}>
      <BarChart
        accessibilityLayer
        data={data}
        layout={isColumns ? "horizontal" : "vertical"}
        margin={isColumns ? { left: 0, right: 8, top: 20, bottom: 4 } : { left: 0, right: 40, top: 4, bottom: 4 }}
      >
        <CartesianGrid
          horizontal={isColumns}
          vertical={!isColumns}
          strokeDasharray="3 3"
          className="stroke-border/60"
        />
        {isColumns ? (
          <XAxis type="category" dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        ) : (
          <XAxis type="number" hide />
        )}
        {isColumns ? (
          <YAxis type="number" width={36} tickLine={false} axisLine={false} allowDecimals={false} />
        ) : (
          <YAxis
            type="category"
            dataKey="label"
            width={categoryWidth}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={truncateTick}
          />
        )}
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
        {series.map((entry, index) => {
          const isTopOfStack = index === series.length - 1;
          return (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              stackId="category"
              fill={entry.color}
              maxBarSize={isColumns ? 40 : undefined}
              // A 2px stroke in the card's own colour is the gap between stacked segments —
              // adjacent fills never touch, which is what keeps the boundaries readable.
              stroke="var(--card)"
              strokeWidth={2}
              radius={isTopOfStack ? (isColumns ? [4, 4, 0, 0] : [0, 4, 4, 0]) : 0}
            >
              {isTopOfStack ? (
                <LabelList
                  dataKey="total"
                  position={isColumns ? "top" : "right"}
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                />
              ) : null}
            </Bar>
          );
        })}
      </BarChart>
    </ChartContainer>
  );
};
