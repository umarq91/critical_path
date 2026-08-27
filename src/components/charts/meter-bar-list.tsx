import { cn } from "@/lib/utils";
import { VIZ_TRACK_COLOR } from "@/constants/chart-colors";

export interface MeterBarListItem {
  id: string;
  label: string;
  value: number;
  /** Direct label at the end of the row, e.g. "420 (33.7%)". */
  caption: string;
  color?: string | null;
}

interface MeterBarListProps {
  items: MeterBarListItem[];
  /** px reserved for the row labels, so every track starts on the same vertical line. */
  labelWidth?: number;
  className?: string;
}

// A ranked magnitude list — one bar per entity against a shared track. Deliberately plain
// CSS rather than a Recharts layout: at this size the row IS the label + the mark + the
// value, and a chart library would only add a plot area to fight with.
//
// Bars are scaled against the largest value, not the total: the comparison the eye is being
// asked to make is between rows, and the share of the whole is already spelled out in each
// row's caption.
export const MeterBarList = ({ items, labelWidth = 96, className }: MeterBarListProps) => {
  const max = items.reduce((highest, item) => Math.max(highest, item.value), 0);

  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 text-sm" title={`${item.label}: ${item.caption}`}>
          <span className="shrink-0 truncate text-muted-foreground" style={{ width: labelWidth }}>
            {item.label}
          </span>
          <span
            className="h-5 min-w-0 flex-1 overflow-hidden rounded-sm"
            style={{ backgroundColor: VIZ_TRACK_COLOR }}
            aria-hidden
          >
            <span
              className="block h-full rounded-sm transition-[width] duration-300"
              style={{
                width: `${max === 0 ? 0 : (item.value / max) * 100}%`,
                backgroundColor: item.color ?? "var(--primary)",
              }}
            />
          </span>
          <span className="shrink-0 tabular-nums text-foreground">{item.caption}</span>
        </li>
      ))}
    </ul>
  );
};
