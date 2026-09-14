"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { searchItemsForRole, matchSearchItems, type SearchItem } from "@/constants/search-index";
import type { Role } from "@/constants/roles";
import { cn } from "@/lib/utils";

// Fixed display order for result groups — independent of match rank, so headers don't reorder
// themselves as the user types. A section with no matches for the current query is skipped.
const SECTION_ORDER = ["Pages", "Management", "Settings"];

export function NavSearch({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => searchItemsForRole(role), [role]);
  const results = useMemo(() => matchSearchItems(items, query), [items, query]);
  // Derived at render time, not stored — keeps the highlighted row in bounds as `results`
  // shrinks while typing, without a useEffect just to re-sync one number.
  const clampedActiveIndex = results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);

  // Cmd/Ctrl+K opens the palette from anywhere in the app, matching the kbd hint already shown
  // on the trigger — a real DOM event subscription, not derived state, so a plain effect is the
  // right tool here.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function navigate(item: SearchItem) {
    router.push(item.href);
    setOpen(false);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && clampedActiveIndex >= 0) {
      event.preventDefault();
      navigate(results[clampedActiveIndex]);
    }
  }

  const resultsWithIndex = results.map((item, index) => ({ item, index }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button type="button" className="relative w-full max-w-md text-left">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="flex h-9 items-center rounded-lg border border-input bg-transparent pr-14 pl-8 text-base text-muted-foreground md:text-sm">
              Search anything...
            </span>
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
        }
      />
      <DialogContent showCloseButton={false} className="top-[16%] max-w-xl -translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Search the platform</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages, features, settings..."
            className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="pointer-events-none shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {resultsWithIndex.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches for &quot;{query}&quot;.</p>
          ) : (
            SECTION_ORDER.map((section) => {
              const sectionResults = resultsWithIndex.filter(({ item }) => item.section === section);
              if (sectionResults.length === 0) return null;

              return (
                <div key={section} className="mb-2 last:mb-0">
                  <p className="px-2.5 py-1 text-overline text-muted-foreground">{section}</p>
                  {sectionResults.map(({ item, index }) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                        index === clampedActiveIndex ? "bg-muted" : "hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
