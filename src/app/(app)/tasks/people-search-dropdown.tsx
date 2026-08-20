"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search, UserSearch, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchAssignablePeople } from "@/app/(app)/tasks/_actions";
import { PersonRow, type PersonSummary } from "@/app/(app)/tasks/person-row";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 150;

interface PeopleSearchDropdownProps {
  excludeIds: string[];
  onAdd: (person: PersonSummary) => void;
  disabled?: boolean;
  placeholder?: string;
}

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

export const PeopleSearchDropdown = ({ excludeIds, onAdd, disabled, placeholder }: PeopleSearchDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<PersonSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  // Resets and re-fetches page 1 whenever the dropdown opens or the (debounced) search term
  // changes — deliberately NOT keyed on excludeIds, so adding someone doesn't re-trigger a
  // network round trip; the currently-held results are filtered client-side instead (below).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Flipping the loading flag before the request resolves — not derivable from existing
    // state — is the documented shape for a search-as-you-type effect (react.dev's own
    // "Fetching data" example does the same); the lint rule's general "avoid direct setState
    // in an Effect" guidance doesn't have a non-Effect alternative for this case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    searchAssignablePeople({ query: debouncedQuery || undefined, excludeIds, page: 1, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setIsLoading(false);
        if (!result.ok) {
          setError(result.error);
          setResults([]);
          setHasMore(false);
          return;
        }
        setResults(result.data);
        setHasMore(result.hasMore);
        setPage(1);
      })
      // A rejected promise (network failure, the Server Action throwing) has to reset
      // isLoading too — without this the spinner never stops, since only the .then() branch
      // above was clearing it.
      .catch((err: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        setError(err instanceof Error ? err.message : "Something went wrong");
        setResults([]);
        setHasMore(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedQuery]);

  async function handleLoadMore() {
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const result = await searchAssignablePeople({
        query: debouncedQuery || undefined,
        excludeIds,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResults((prev) => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoadingMore(false);
    }
  }

  // Hides anyone added since the last fetch without waiting on a new request — the parent
  // re-renders with an updated excludeIds the instant it adds someone.
  const visibleResults = results.filter((person) => !excludeIds.includes(person.id));
  const hasQuery = debouncedQuery.trim().length > 0;
  // True from the first keystroke, not just once the debounced fetch actually starts — closes
  // the gap where stale results sat on screen for the whole debounce window looking frozen.
  const isPending = isLoading || query !== debouncedQuery;

  // The search input is the popover's anchor (for positioning) but deliberately isn't a
  // <Popover.Trigger> — a trigger opens on click/press, and this should open on focus and
  // stay open while the user types. Without a Trigger, Base UI never registers the input as
  // the popover's "reference" element, so its outside-press dismissal doesn't know the input
  // is part of the popover — any pointerdown inside it (repositioning the caret, selecting
  // text, right-click-to-cut) reads as an outside press and closes the popover mid-search.
  // Filter out only that specific case (by the reason Base UI attaches to the close, not
  // escapeKey or a real focus-out) instead of fighting its internal reference wiring.
  function handleOpenChange(nextOpen: boolean, eventDetails: { reason?: string; event?: Event | null }) {
    if (!nextOpen && eventDetails.reason === "outsidePress") {
      const target = eventDetails.event?.target as Node | null;
      if (target && anchorRef.current?.contains(target)) return;
    }
    setOpen(nextOpen);
  }

  return (
    <div className="relative">
      <div ref={anchorRef} className="relative">
        {isPending ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search and add people..."}
          disabled={disabled}
          className="pl-8"
        />
      </div>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverContent
          anchor={anchorRef}
          initialFocus={inputRef}
          finalFocus={false}
          className="w-(--anchor-width) p-0"
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {isPending ? (
              <>
                <ResultSkeleton />
                <ResultSkeleton />
                <ResultSkeleton />
              </>
            ) : error ? (
              <EmptyState title="Couldn't load people" description={error} className="py-8" />
            ) : visibleResults.length === 0 ? (
              hasQuery ? (
                <EmptyState icon={UserSearch} title="No people found" description="Try searching by name or email." className="py-8" />
              ) : (
                <EmptyState icon={Users} title="No members available" description="There are no members available to add." className="py-8" />
              )
            ) : (
              <>
                {visibleResults.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    className="px-3 py-2 hover:bg-accent"
                    trailing={
                      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAdd(person)}>
                        <Plus className="size-3.5" />
                        Add
                      </Button>
                    }
                  />
                ))}
                {hasMore ? (
                  <div className="px-3 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      disabled={isLoadingMore}
                      onClick={handleLoadMore}
                    >
                      {isLoadingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Load more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
