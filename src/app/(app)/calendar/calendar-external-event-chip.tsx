import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import type { ExternalCalendarEvent } from "@/data/external-calendar-events";

interface CalendarExternalEventChipProps {
  event: ExternalCalendarEvent;
  variant?: "compact" | "full";
}

// Read-only — these come from the rest of the user's Google Calendar (meetings, personal
// events), not from a task, so there's nothing here to click into or edit. Dashed blue border +
// blue tint deliberately distinguish it from a real (solid, clickable) task chip while tying
// it visually back to Google Calendar.
export const CalendarExternalEventChip = ({ event, variant = "compact" }: CalendarExternalEventChipProps) => {
  const timeLabel = event.all_day ? null : format(parseISO(event.starts_at), "h:mmaaa").toLowerCase();

  if (variant === "compact") {
    return (
      <div
        className="flex w-full items-center gap-1.5 truncate rounded-md border border-dashed border-primary/40 bg-primary-tint px-2 py-1.5 text-left text-sm text-primary lg:text-base"
        title={event.title}
      >
        <CalendarClock className="size-3.5 shrink-0" />
        <span className="truncate">
          {timeLabel ? <span className="font-medium">{timeLabel} </span> : null}
          {event.title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 rounded-lg border border-dashed border-primary/40 bg-primary-tint p-4 text-left">
      <div className="flex items-center gap-2 text-primary">
        <CalendarClock className="size-4 shrink-0" />
        <span className="truncate text-base font-medium lg:text-lg">{event.title}</span>
      </div>
      {timeLabel ? <span className="text-sm text-primary/70">{timeLabel}</span> : null}
    </div>
  );
};
