import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ListHolidaysParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["holiday_date", "name", "country"]);

export async function listHolidays({ page = 1, pageSize = 10, sortBy, sortDir, filters = {} }: ListHolidaysParams = {}) {
  const supabase = await createClient();
  let query = supabase.from("public_holidays").select("*", { count: "exact" });

  if (filters.country) query = query.eq("country", filters.country);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "holiday_date";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Holiday = Awaited<ReturnType<typeof listHolidays>>["data"][number];

interface ListHolidaysByDateRangeParams {
  from: string;
  to: string;
  /** Omitted or empty means unfiltered — every country's holidays in range. */
  countries?: string[];
}

// Powers the Calendar view — bounded by the visible date range (a week or a month at most), so
// it returns every matching row for that range at once rather than listHolidays()'s paginated
// shape, same reasoning as listTasksByDueDateRange.
export async function listHolidaysByDateRange({ from, to, countries }: ListHolidaysByDateRangeParams) {
  const supabase = await createClient();
  let query = supabase
    .from("public_holidays")
    .select("*")
    .gte("holiday_date", from)
    .lte("holiday_date", to)
    .order("holiday_date", { ascending: true });

  if (countries && countries.length > 0) query = query.in("country", countries);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// The Calendar's country filter checkbox list — every country that actually has at least one
// holiday row, not a fixed constant. This is what lets a country typed into a new holiday show
// up as its own checkbox without a code change (country is plain text, see
// 0027_public_holidays.sql).
export async function listDistinctHolidayCountries(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("public_holidays").select("country").order("country");
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.country))];
}
