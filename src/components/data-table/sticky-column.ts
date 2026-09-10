import { cn } from "@/lib/utils";
import type { DataTableColumnMeta } from "@/components/data-table/table-features";
import type { TableScrollEdges } from "@/components/data-table/use-table-scroll-edges";

// Pins a column (e.g. Actions) to an edge during horizontal scroll. `background` must be a
// fully opaque colour — a translucent one lets the cells scrolling underneath show through.
// The divider only appears once the column is genuinely pinned: parked at its own edge it sits
// flush with the rest of the row, where a border would just be a stray line. It's a transparent
// border the rest of the time so nothing reflows by a pixel when it fades in.
export function getStickyCellClassName(
  meta: DataTableColumnMeta | undefined,
  background: string,
  edges: TableScrollEdges
) {
  if (!meta?.sticky) return undefined;
  const isRight = meta.sticky === "right";
  const isPinned = isRight ? !edges.atEnd : !edges.atStart;
  return cn(
    "sticky z-10 border-transparent transition-colors",
    background,
    isRight ? "right-0 border-l" : "left-0 border-r",
    isPinned && "border-border-subtle"
  );
}
