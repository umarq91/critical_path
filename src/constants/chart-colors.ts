// Mirrors --viz-1..7 / --viz-track in globals.css. Charting libraries (Recharts, etc.)
// take raw color values in props, not Tailwind classes, so this is the JS-usable form of
// the same tokens — keep both in sync with Design and color palette.md §3 if either changes.
export const VIZ_COLORS = [
  "#2B6EF6",
  "#1FBF75",
  "#F5A524",
  "#F0463C",
  "#14B8A6",
  "#8B5CF6",
  "#6366F1",
] as const;

export const VIZ_TRACK_COLOR = "#E9ECF1";
