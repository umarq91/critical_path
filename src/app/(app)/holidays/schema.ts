import { z } from "zod";
import { isValid } from "date-fns";
import { parseDateOnly } from "@/lib/dates";

// Shared by the single "Add Holiday" form and every row of a bulk CSV import — one validation
// rule, not two. `country` is a loose string, not z.enum(...): public_holidays.country is plain
// text (see 0027_public_holidays.sql), so a country outside KNOWN_HOLIDAY_COUNTRIES is still
// valid, just one the form/template doesn't have a friendly label for.
export const holidaySchema = z.object({
  country: z.string().trim().min(1, "Country is required").max(100),
  holiday_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .refine((value) => isValid(parseDateOnly(value)), "Not a real date"),
  name: z.string().trim().min(1, "Event name is required").max(200),
  description: z.string().trim().max(2000).optional(),
});

export type HolidayInput = z.infer<typeof holidaySchema>;

// Shared by the "Download CSV Format" button (the only row it writes) and bulkImportHolidays
// (what it matches an uploaded file's header row against), so the two can never drift apart.
export const HOLIDAY_CSV_HEADERS = ["Date (DD-MM-YYYY)", "Event Name", "Description", "Country"] as const;

export const HOLIDAY_CSV_DATE_FORMAT_ERROR = "Date must be in DD-MM-YYYY format";

// A CSV row's date is day-first (client's format); holidaySchema and the database want ISO.
// Slashes are accepted because a spreadsheet re-saving the file often swaps them in, and ISO
// still passes so files made from the older template keep importing. Null = unrecognised.
export function csvDateToIso(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export const MAX_BULK_HOLIDAY_ROWS = 500;
