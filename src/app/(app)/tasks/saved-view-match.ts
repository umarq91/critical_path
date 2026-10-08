import { TASKS_QUERY_STATE } from "@/app/(app)/tasks/query-state";
import type { SavedView } from "@/data/saved-views";

export interface GridViewState {
  filters: Record<string, string>;
  sortBy?: string;
  sortDir?: string;
}

const DEFAULT_SORT_BY = TASKS_QUERY_STATE.defaultSort?.id ?? "";
const DEFAULT_SORT_DIR = TASKS_QUERY_STATE.defaultSort?.desc ? "desc" : "asc";

// A view saved with no sort lands on the grid's default sort, so both sides are compared after
// filling in that default — otherwise a freshly applied view would immediately read as edited.
function sameState(view: SavedView, current: GridViewState) {
  if ((view.sortBy || DEFAULT_SORT_BY) !== (current.sortBy || DEFAULT_SORT_BY)) return false;
  if ((view.sortDir || DEFAULT_SORT_DIR) !== (current.sortDir || DEFAULT_SORT_DIR)) return false;

  const viewKeys = Object.keys(view.filters);
  if (viewKeys.length !== Object.keys(current.filters).length) return false;
  return viewKeys.every((key) => view.filters[key] === current.filters[key]);
}

// Selection is only ever the `?view=` param — never inferred from the grid happening to match a
// view's filters — so deselecting sticks, and a view stays selected (shown as edited) after its
// filters change.
export function resolveActiveView(savedViews: SavedView[], viewParam: string | null, current: GridViewState) {
  const view = savedViews.find((candidate) => candidate.id === viewParam);
  if (!view) return null;
  return { view, isModified: !sameState(view, current) };
}
