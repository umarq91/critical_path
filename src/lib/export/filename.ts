import { format } from "date-fns";

/** Characters that are either a path separator on some OS or reserved by Windows filenames —
 *  stripped so a scope label containing one (a season name, a status) can't produce a filename
 *  the browser silently mangles or a Windows user can't open. */
const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * `<context>-export-<scope>-<yyyy-MM-dd>.<ext>` — e.g. `dashboard-export-filtered-2026-09-11.xlsx`.
 * `scope` is omitted entirely when there's nothing to say (an unfiltered export), rather than
 * printing a redundant "all".
 */
export function buildExportFilename(context: string, extension: string, scope?: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const parts = [context, "export", scope, today].filter(Boolean);
  return `${parts.join("-").replace(UNSAFE_FILENAME_CHARS, "")}.${extension}`;
}
