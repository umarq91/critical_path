import { cn } from "@/lib/utils";

export interface ChartLegendItem {
  label: string;
  color: string;
  value?: number | string;
}

interface ChartSeriesLegendProps {
  items: ChartLegendItem[];
  /** "inline" wraps items in a row under the plot; "stacked" is a one-per-line column with
   *  the values right-aligned, for the donut cards that put their legend beside the ring. */
  layout?: "inline" | "stacked";
  className?: string;
}

// Identity is never carried by colour alone: the palette's adjacent hues sit inside the
// colourblind-separation floor band, which is only legal alongside a second encoding. This
// legend (plus the value labels on the marks themselves) is that encoding — every chart in
// components/charts renders one.
export const ChartSeriesLegend = ({ items, layout = "inline", className }: ChartSeriesLegendProps) => {
  const stacked = layout === "stacked";

  return (
    <ul
      className={cn(
        "flex",
        stacked ? "flex-col gap-2" : "flex-wrap items-center gap-x-4 gap-y-2",
        className
      )}
    >
      {items.map((item) => (
        <li key={item.label} className={cn("flex items-center gap-2 text-sm", stacked && "justify-between")}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: item.color }} aria-hidden />
            <span className="truncate text-muted-foreground">{item.label}</span>
          </span>
          {item.value !== undefined ? (
            <span className="shrink-0 font-medium text-foreground tabular-nums">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
