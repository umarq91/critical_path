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
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine((value) => isValid(parseDateOnly(value)), "Not a real date"),
  name: z.string().trim().min(1, "Event name is required").max(200),
  description: z.string().trim().max(2000).optional(),
});

export type HolidayInput = z.infer<typeof holidaySchema>;

// Shared by the "Download CSV Format" button (the only row it writes) and bulkImportHolidays
// (what it matches an uploaded file's header row against), so the two can never drift apart.
export const HOLIDAY_CSV_HEADERS = ["Date", "Event Name", "Description", "Country"] as const;

export const MAX_BULK_HOLIDAY_ROWS = 500;
