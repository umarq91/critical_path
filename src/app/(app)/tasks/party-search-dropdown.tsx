"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchAssignableParties } from "@/app/(app)/tasks/_participant-actions";
import { PartyRow } from "@/app/(app)/tasks/party-row";
import type { PartySummary } from "@/lib/party";
import { cn } from "@/lib/utils";

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
  const [activeIndex, setActiveIndex] = useState(0);
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
  // Offered whenever there is something to dismiss — a typed term, an open panel, or both.
  const showClear = !disabled && (open || query.length > 0);
  // Already-picked parties disappear the moment they're added, without refetching.
  const results = state.status === "ready" ? state.results.filter((party) => !excludeKeys.includes(party.key)) : [];
  // Clamped at read time: adding a party drops it from `results`, which can leave the stored
  // index one past the end.
  const highlightedIndex = Math.min(activeIndex, results.length - 1);

  // Rendered in flow rather than in a popover: this sits inside a scrollable sheet, where a
  // portalled panel needs anchor tracking to behave. The trade is that dismissal is ours to
  // handle, and it takes both of the below — focus-out alone misses a click on anything
  // non-focusable (the drawer's own body text, a heading, the backdrop), which never blurs the
  // input in every browser, leaving the panel open over the page.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Still needed alongside the above for keyboard dismissal — tabbing out of the last result
  // moves focus without a pointer ever being pressed.
  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
  }

  function clearSearch() {
    setQuery("");
    setOpen(false);
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
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          // This input lives inside the task form — without preventDefault, Enter would submit
          // the task instead. Enter adds the highlighted result (the top one unless the arrow
          // keys moved it) so typing a name and hitting Enter is enough; it's a no-op while
          // results are still catching up with what's typed, same guard as the "no matches"
          // empty state below.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!isLoading && results.length > 0) onAdd(results[highlightedIndex]);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActiveIndex(Math.max(0, Math.min(highlightedIndex + step, results.length - 1)));
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder ?? "Search departments and people..."}
          disabled={disabled}
          className={cn("pl-8", showClear && "pr-9")}
        />
        {showClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear search"
            // onMouseDown, not onClick: the pointerdown dismissal above would otherwise have
            // already closed the panel, and the input's blur would fire first — this way one
            // press both clears the term and closes, which is the point of the button.
            onMouseDown={(event) => {
              event.preventDefault();
              clearSearch();
            }}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        ) : null}
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
              {results.map((party, index) => (
                // The whole row is the click target, not just the Add pill — which is therefore
                // a styled span, since a button can't nest inside another.
                <button
                  key={party.key}
                  type="button"
                  onClick={() => onAdd(party)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "block w-full cursor-pointer px-3 py-2 text-left outline-none focus-visible:bg-accent",
                    index === highlightedIndex && "bg-accent"
                  )}
                >
                  <PartyRow
                    party={party}
                    trailing={
                      <span className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1" })}>
                        <Plus className="size-3.5" />
                        Add
                      </span>
                    }
                  />
                </button>
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
