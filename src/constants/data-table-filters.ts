// A `multiple: true` toolbar filter (data-table-toolbar.tsx) still stores ONE string in the
// shared `filters` URL param — the same shape every other (single-select) filter on every table
// in the app uses (see data-table-search-params.ts's `filtersSchema`) — by joining the selected
// option values with this delimiter. IDs here are always uuids or `kind:uuid` party keys
// (lib/party.ts), neither of which can contain a comma, so the join is unambiguous to split back.
export const MULTI_FILTER_DELIMITER = ",";

export function encodeMultiFilterValue(values: string[]): string | undefined {
  return values.length > 0 ? values.join(MULTI_FILTER_DELIMITER) : undefined;
}

export function decodeMultiFilterValue(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(MULTI_FILTER_DELIMITER).filter(Boolean);
}
