// Plain hex mirrors of the --viz-* tokens in globals.css, for consumers that need color
// values as props/data rather than Tailwind classes — Recharts series, <ColorField> swatches.
// Keep in sync with globals.css if the palette changes.
export const VIZ_COLORS = ["#2b6ef6", "#1fbf75", "#f5a524", "#f0463c", "#14b8a6", "#8b5cf6", "#6366f1"] as const;

export const VIZ_TRACK_COLOR = "#e9ecf1";

// Deterministic color pick from the palette above, for entities with no stored color of
// their own (e.g. a task's assignee avatar) — same id always resolves to the same color.
export function getVizColorForId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return VIZ_COLORS[Math.abs(hash) % VIZ_COLORS.length];
}
