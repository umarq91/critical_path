import { VIZ_COLORS } from "@/constants/chart-colors";

// Google Calendar can't take an arbitrary hex on an event: `colorId` is one of 11 fixed colours.
// Hexes are what Google's own UI shows for each id (the colors.get API still returns an older,
// paler set, so don't "correct" these from it).
const GOOGLE_EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb", // Lavender
  "2": "#33b679", // Sage
  "3": "#8e24aa", // Grape
  "4": "#e67c73", // Flamingo
  "5": "#f6bf26", // Banana
  "6": "#f4511e", // Tangerine
  "7": "#039be5", // Peacock
  "8": "#616161", // Graphite
  "9": "#3f51b5", // Blueberry
  "10": "#0b8043", // Basil
  "11": "#d50000", // Tomato
};

// The app's colour picker only offers VIZ_COLORS, so those are pinned by hand. Nearest-match alone
// would fold teal into green (both Sage) and indigo into blue (both Blueberry), and two seasons
// that look different in the app would look the same in Google.
const PINNED: Record<(typeof VIZ_COLORS)[number], string> = {
  "#2b6ef6": "9", // blue -> Blueberry
  "#1fbf75": "2", // green -> Sage
  "#f5a524": "5", // amber -> Banana
  "#f0463c": "11", // red -> Tomato
  "#14b8a6": "7", // teal -> Peacock
  "#8b5cf6": "3", // violet -> Grape
  "#6366f1": "1", // indigo -> Lavender
};

function toRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// The Google colorId that best matches an in-app colour. Null (Google's calendar default) only for
// a value that isn't a hex at all.
export function googleEventColorId(hex: string): string | null {
  const pinned = PINNED[hex.trim().toLowerCase() as keyof typeof PINNED];
  if (pinned) return pinned;

  const rgb = toRgb(hex);
  if (!rgb) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const [id, candidate] of Object.entries(GOOGLE_EVENT_COLORS)) {
    const other = toRgb(candidate);
    if (!other) continue;
    // Weighted RGB ("redmean"), close enough to perceptual for picking 1 of 11.
    const meanRed = (rgb[0] + other[0]) / 2;
    const [dr, dg, db] = [rgb[0] - other[0], rgb[1] - other[1], rgb[2] - other[2]];
    const distance = (2 + meanRed / 256) * dr * dr + 4 * dg * dg + (2 + (255 - meanRed) / 256) * db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

// Holidays are always accent-teal in the app (calendar-holiday-chip.tsx, #14b8a6), the same hue
// as the teal season colour, so they get the same Google colour.
export const HOLIDAY_GOOGLE_COLOR_ID = PINNED["#14b8a6"];
