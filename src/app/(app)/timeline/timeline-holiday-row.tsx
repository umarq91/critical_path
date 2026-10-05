import { PartyPopper } from "lucide-react";
import { formatHolidayTitle } from "@/constants/holiday-country";
import { formatDate } from "@/lib/dates";
import { ROW_HEIGHT, type TimelineHolidayDay } from "@/app/(app)/timeline/timeline-utils";

// Below this a day is too narrow for a caption (Month view and coarser), so the marker is the
// icon alone and the names live in its tooltip.
const MIN_DAY_WIDTH_FOR_LABEL = 100;
const ICON_SIZE = 14;

interface TimelineHolidayRowProps {
  days: TimelineHolidayDay[];
  dayWidth: number;
  panelWidth: number;
  timelineWidth: number;
}

// A pinned row above the tasks that names each public holiday in the window, in the Calendar's
// accent-teal holiday treatment. The matching full-height day bands are drawn by TimelineGrid.
export const TimelineHolidayRow = ({ days, dayWidth, panelWidth, timelineWidth }: TimelineHolidayRowProps) => {
  const showLabels = dayWidth >= MIN_DAY_WIDTH_FOR_LABEL;

  return (
    <div className="flex border-b border-border">
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-card px-3 text-xs font-semibold text-accent-teal"
        style={{ width: panelWidth, minHeight: ROW_HEIGHT }}
      >
        <PartyPopper className="size-4 shrink-0" />
        Public Holidays
      </div>
      <div className="relative" style={{ width: timelineWidth, minHeight: ROW_HEIGHT }}>
        {days.map((day) => {
          const names = day.holidays.map(formatHolidayTitle);
          const title = `${formatDate(day.date)} · ${names.join(", ")}`;
          if (showLabels) {
            return (
              <span
                key={day.date}
                title={title}
                className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-sm border border-accent-teal/30 bg-accent-teal/15 px-1.5 py-0.5 text-xs text-accent-teal"
                style={{ left: day.offset + 4, width: dayWidth - 8 }}
              >
                <PartyPopper className="size-3 shrink-0" />
                <span className="truncate">{names.length > 1 ? `${names.length} holidays` : names[0]}</span>
              </span>
            );
          }
          return (
            <span
              key={day.date}
              title={title}
              aria-label={title}
              role="img"
              className="absolute top-1/2 -translate-y-1/2 text-accent-teal"
              style={{ left: day.offset + dayWidth / 2 - ICON_SIZE / 2 }}
            >
              <PartyPopper style={{ width: ICON_SIZE, height: ICON_SIZE }} />
            </span>
          );
        })}
      </div>
    </div>
  );
};
