"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchAssignableParties } from "@/app/(app)/tasks/_actions";
import { PartyRow } from "@/app/(app)/tasks/party-row";
import type { PartySummary } from "@/lib/party";

const SEARCH_DEBOUNCE_MS = 200;

interface PartySearchDropdownProps {
  excludeKeys: string[];
  onAdd: (party: PartySummary) => void;
  disabled?: boolean;
  placeholder?: string;
}

// `forQuery` is the term the results actually answer. Comparing it to what's in the box is how
// "still loading" is derived rather than stored — flipping a loading flag as the effect starts
// would mean a synchronous setState inside the effect, and this needs no such thing.
type SearchState =
  | { status: "pending" }
  | { status: "error"; forQuery: string; message: string }
  | { status: "ready"; forQuery: string; results: PartySummary[]; truncated: boolean };

function ResultSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Skeleton className="size-6 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
    </div>
  );
}

export const PartySearchDropdown = ({ excludeKeys, onAdd, disabled, placeholder }: PartySearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "pending" });
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    searchAssignableParties({ query: debouncedQuery || undefined })
      .then((result) => {
        if (cancelled) return;
        setState(
          result.ok
            ? { status: "ready", forQuery: debouncedQuery, results: result.data, truncated: result.truncated }
            : { status: "error", forQuery: debouncedQuery, message: result.error }
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          forQuery: debouncedQuery,
          message: error instanceof Error ? error.message : "Something went wrong",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  // Covers both gaps in one comparison: the debounce window, and the request in flight after
  // it. Either way the results on hand answer an older term than what's in the box, and showing
  // them as if they were current is what makes a search feel wrong.
  const isLoading = state.status === "pending" || state.forQuery !== query;
  // Already-picked parties disappear the moment they're added, without refetching.
  const results = state.status === "ready" ? state.results.filter((party) => !excludeKeys.includes(party.key)) : [];

  // Rendered in flow rather than in a popover: this sits inside a scrollable sheet, where a
  // portalled panel needs anchor tracking and its own outside-press handling to behave. Closing
  // on focus leaving the whole container is the only dismissal logic needed here.
  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5" onBlur={handleBlur}>
      <div className="relative">
        {isLoading && open ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          // This input lives inside the task form — without this, Enter submits the task
          // instead of doing nothing useful.
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder ?? "Search departments and people..."}
          disabled={disabled}
          className="pl-8"
        />
      </div>

      {open ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md">
          {isLoading ? (
            <>
              <ResultSkeleton />
              <ResultSkeleton />
              <ResultSkeleton />
            </>
          ) : state.status === "error" ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{state.message}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {query.trim() ? `No matches for "${query.trim()}"` : "Nothing left to add"}
            </p>
          ) : (
            <>
              {results.map((party) => (
                <PartyRow
                  key={party.key}
                  party={party}
                  className="px-3 py-2 hover:bg-accent"
                  trailing={
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAdd(party)}>
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  }
                />
              ))}
              {state.status === "ready" && state.truncated ? (
                <p className="px-3 py-2 text-center text-xs text-muted-foreground">
                  Showing the first 50 — keep typing to narrow it down.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
