"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export interface TableScrollEdges {
  atStart: boolean;
  atEnd: boolean;
}

// Sub-pixel scroll positions (trackpads, zoom) never land exactly on the bounds.
const EDGE_TOLERANCE = 1;

// Tracks whether the table is scrolled away from either horizontal edge, so a sticky column can
// show its divider only while cells are actually passing underneath it. The scroll container is
// created by the shadcn <Table> primitive rather than by us, hence the lookup by its `data-slot`
// from a wrapper we do own.
export function useTableScrollEdges<T extends HTMLElement>(): [RefObject<T | null>, TableScrollEdges] {
  const wrapperRef = useRef<T>(null);
  const [edges, setEdges] = useState<TableScrollEdges>({ atStart: true, atEnd: true });

  useEffect(() => {
    const container = wrapperRef.current?.querySelector<HTMLElement>('[data-slot="table-container"]');
    if (!container) return;

    const measure = () => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const atStart = container.scrollLeft <= EDGE_TOLERANCE;
      const atEnd = container.scrollLeft >= maxScroll - EDGE_TOLERANCE;
      setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }));
    };

    measure();
    container.addEventListener("scroll", measure, { passive: true });

    // Column widths change with the data, not just with the viewport, so watch the table too.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (container.firstElementChild) observer.observe(container.firstElementChild);

    return () => {
      container.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  return [wrapperRef, edges];
}
