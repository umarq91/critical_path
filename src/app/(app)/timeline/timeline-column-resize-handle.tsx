"use client";

import { useRef } from "react";

interface TimelineColumnResizeHandleProps {
  width: number;
  onResize: (width: number) => void;
  label: string;
}

// A drag strip on a header cell's right edge. Pointer capture keeps the drag tracking even when
// the cursor leaves the strip (or the window), so a fast drag doesn't stall mid-way.
export const TimelineColumnResizeHandle = ({
  width,
  onResize,
  label,
}: TimelineColumnResizeHandleProps) => {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidth: width };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onResize(drag.current.startWidth + event.clientX - drag.current.startX);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:bg-border hover:after:bg-primary"
    />
  );
};
