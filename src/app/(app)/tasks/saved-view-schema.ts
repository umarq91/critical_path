import { z } from "zod";

const savedViewName = z.string().trim().min(1, "Name is required").max(100);

// Full payload the Server Action validates — filters/sortBy/sortDir come from the URL
// (data-table-search-params.ts), not user input, but are still re-validated server-side like
// everything else a Server Action receives.
export const savedViewSchema = z.object({
  name: savedViewName,
  filters: z.record(z.string(), z.string()),
  sortBy: z.string().optional(),
  sortDir: z.string().optional(),
});

// What the "Save current filters" form actually collects — just the name. filters/sortBy/sortDir
// are read off the current URL by the caller, not typed by the user, so they don't belong on
// this form's own resolver.
export const savedViewNameSchema = z.object({ name: savedViewName });

export type SavedViewInput = z.infer<typeof savedViewSchema>;
export type SavedViewNameInput = z.infer<typeof savedViewNameSchema>;
