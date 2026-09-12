import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// Matches supabase/schema.md's task_dpsp_category enum exactly (demand/product/sales/profit).
// Unlike task-status.ts/task-gender.ts, there's no existing meaning-carrying token family for
// these four — status/priority/gender tokens each already mean something else. viz-1/2/3/6
// (the categorical chart palette, see chart-colors.ts) is the right family to reuse instead:
// it exists precisely to give N unrelated categories distinct, colorblind-considered colors,
// and happens to land on the same blue/green/amber/purple the client's own DPSP mockup uses.
export const DPSP_CATEGORY_CONFIG: StatusBadgeConfig = {
  demand: {
    label: "Demand",
    className: "border border-viz-1 bg-viz-1/10 text-viz-1",
  },
  product: {
    label: "Product",
    className: "border border-viz-6 bg-viz-6/10 text-viz-6",
  },
  sales: {
    label: "Sales",
    className: "border border-viz-3 bg-viz-3/10 text-viz-3",
  },
  profit: {
    label: "Profit",
    className: "border border-viz-2 bg-viz-2/10 text-viz-2",
  },
};

// Solid-fill counterpart for surfaces that need a strong color block rather than a soft badge —
// the Flywheel board's column headers and wheel diagram, mirroring how seasons/columns.tsx
// already uses solid bg-viz-* for owner-initial avatars.
export const DPSP_CATEGORY_SOLID_CLASSNAME: Record<"demand" | "product" | "sales" | "profit", string> = {
  demand: "bg-viz-1",
  product: "bg-viz-6",
  sales: "bg-viz-3",
  profit: "bg-viz-2",
};
