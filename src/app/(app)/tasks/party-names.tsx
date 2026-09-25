"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PartyChip } from "@/app/(app)/tasks/party-chip";
import type { PartySummary } from "@/lib/party";

const CHIP_GAP_PX = 4;

interface PartyNamesProps {
  parties: PartySummary[];
}

// A task's owners or people involved as named chips on one line, with as many shown as the
// column's current width fits and the rest folded into "+N more". The fit is measured, not a
// fixed count: the grid's columns are user-resizable, so "3 names" would either clip or leave
// space unused. An offscreen copy of every chip supplies the widths; a ResizeObserver on the
// cell re-runs the fit when a column is dragged.
export const PartyNames = ({ parties }: PartyNamesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(parties.length);
  // Callers derive `parties` fresh on every render, so the fit keys on content, not identity.
  const signature = parties.map((party) => `${party.key}:${party.name}`).join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const fit = () => {
      const elements = Array.from(measure.children) as HTMLElement[];
      const moreWidth = elements.pop()?.offsetWidth ?? 0;
      const widths = elements.map((element) => element.offsetWidth);
      const available = container.clientWidth;

      const total = widths.reduce((sum, width) => sum + width, 0) + CHIP_GAP_PX * (widths.length - 1);
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }

      // Always at least one chip — it truncates its own name rather than vanishing into "+N".
      let count = 1;
      let used = widths[0] + CHIP_GAP_PX + moreWidth;
      while (count < widths.length - 1 && used + widths[count] + CHIP_GAP_PX <= available) {
        used += widths[count] + CHIP_GAP_PX;
        count += 1;
      }
      setVisibleCount(count);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [signature]);

  if (parties.length === 0) return <span className="text-muted-foreground">—</span>;

  const visible = parties.slice(0, visibleCount);
  const overflow = parties.slice(visibleCount);

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center overflow-hidden" style={{ gap: CHIP_GAP_PX }}>
      {visible.map((party) => (
        <PartyChip key={party.key} party={party} className={visible.length === 1 ? "shrink" : undefined} />
      ))}
      {overflow.length > 0 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex h-6 shrink-0 cursor-default items-center rounded-full bg-muted px-2 text-xs font-medium whitespace-nowrap text-muted-foreground" />
            }
          >
            +{overflow.length} more
          </TooltipTrigger>
          <TooltipContent>
            <span className="flex flex-col gap-0.5">
              {overflow.map((party) => (
                <span key={party.key}>{party.name}</span>
              ))}
            </span>
          </TooltipContent>
        </Tooltip>
      ) : null}

      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex w-max whitespace-nowrap"
        style={{ gap: CHIP_GAP_PX }}
      >
        {parties.map((party) => (
          <PartyChip key={party.key} party={party} />
        ))}
        <span className="inline-flex h-6 items-center rounded-full px-2 text-xs font-medium">+{parties.length} more</span>
      </div>
    </div>
  );
};
