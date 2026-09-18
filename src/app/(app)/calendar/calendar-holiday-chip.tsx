import { PartyPopper } from "lucide-react";
import type { Holiday } from "@/data/holidays";

interface CalendarHolidayChipProps {
  holiday: Holiday;
  variant?: "compact" | "full";
}

// A holiday is a distinct tagged highlight, not a plain label (client request) — a single
// consistent accent-teal treatment regardless of country, since the country filter checkboxes
// already do the job of distinguishing countries; this chip's job is just "this day is a
// public holiday".
export const CalendarHolidayChip = ({ holiday, variant = "compact" }: CalendarHolidayChipProps) => {
  const title = holiday.description ? `${holiday.name} — ${holiday.description}` : holiday.name;

  if (variant === "compact") {
    return (
      <span
        className="flex w-full items-center gap-1.5 truncate rounded-md border border-accent-teal/30 bg-accent-teal/15 px-2 py-1 text-sm text-accent-teal lg:text-base"
        title={title}
      >
        <PartyPopper className="size-3.5 shrink-0 lg:size-4" />
        <span className="truncate">{holiday.name}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-accent-teal/30 bg-accent-teal/15 p-3">
      <div className="flex items-center gap-2">
        <PartyPopper className="size-4 shrink-0 text-accent-teal" />
        <span className="text-base font-medium text-accent-teal lg:text-lg">{holiday.name}</span>
        <span className="text-sm text-accent-teal/80">{holiday.country}</span>
      </div>
      {holiday.description ? <p className="text-sm text-accent-teal/80">{holiday.description}</p> : null}
    </div>
  );
};
