"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export interface DonutChartSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartSlice[];
  /** Caption under the centred value, e.g. "Tasks". */
  centerLabel: string;
  /** Headline in the ring's centre. Defaults to the summed total of every slice — pass a
   *  formatted string when the ring's story is a rate rather than a count. */
  centerValue?: string;
  className?: string;
}

export const DonutChart = ({ data, centerLabel, centerValue, className }: DonutChartProps) => {
  const config = Object.fromEntries(
    data.map((slice) => [slice.key, { label: slice.label, color: slice.color }])
  ) as ChartConfig;
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartContainer config={config} className={cn("aspect-square w-full", className)}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((slice) => (
            <Cell key={slice.key} fill={slice.color} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                    {centerValue ?? total.toLocaleString()}
                  </tspan>
                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 22} className="fill-muted-foreground text-sm">
                    {centerLabel}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
