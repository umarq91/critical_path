// Plain hex mirrors of the --viz-* tokens in globals.css, for consumers that need color
// values as props/data rather than Tailwind classes — Recharts series, <ColorField> swatches.
// Keep in sync with globals.css if the palette changes.
export const VIZ_COLORS = ["#2b6ef6", "#1fbf75", "#f5a524", "#f0463c", "#14b8a6", "#8b5cf6", "#6366f1"] as const;

export const VIZ_TRACK_COLOR = "#e9ecf1";

// The aggregated "Other" slice/bar, and the unfilled remainder of a completion ring. A neutral
// ink rather than a palette hue, so folding a tail of categories together never reads as one
// more named category.
export const VIZ_OTHER_COLOR = "var(--muted-foreground)";

// Chart series order. Same tokens as VIZ_COLORS, deliberately re-sequenced: in the palette's
// own order viz-6 (#8b5cf6) and viz-7 (#6366f1) sit next to each other and are indistinguishable
// under protanopia (ΔE 0.8) and near-indistinguishable with normal vision (ΔE 6.3), so any chart
// using slots 6 and 7 would encode two categories in one apparent colour. This order keeps every
// adjacent pair separable and drops viz-7 entirely; a 7th category folds into an "Other" bucket
// rather than being given a colour nobody can tell from the 4th.
// Adjacent green↔amber sits in the 6–8 CVD band, which is only legal alongside a second
// encoding — every chart using this palette must also carry direct value labels or a legend.
export const CATEGORICAL_VIZ_COLORS = ["#2b6ef6", "#f5a524", "#1fbf75", "#8b5cf6", "#f0463c", "#14b8a6"] as const;

// Status and gender are reserved, meaning-carrying scales — never a source of "next series"
// colours. Referenced as CSS vars rather than hex so a token change in globals.css reaches the
// charts too, and so the values track light/dark like every other surface in the app.
export const TASK_STATUS_VIZ_COLORS = {
  not_started: "var(--status-notstarted-base)",
  in_progress: "var(--status-progress-base)",
  completed: "var(--status-complete-base)",
  overdue: "var(--status-overdue-base)",
} as const;

// No "unisex" entry — see constants/task-gender.ts, it's retired from the app layer entirely.
export const TASK_GENDER_VIZ_COLORS = {
  guys: "var(--gender-guys-base)",
  girls: "var(--gender-girls-base)",
} as const;

// Deterministic color pick from the palette above, for entities with no stored color of
// their own (e.g. a task's assignee avatar) — same id always resolves to the same color.
export function getVizColorForId(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index++) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return VIZ_COLORS[Math.abs(hash) % VIZ_COLORS.length];
}
