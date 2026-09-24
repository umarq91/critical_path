// Every in-app event lands on this secondary calendar, never on the user's primary one. Matched
// by name, so an existing calendar the user already made with this name is reused.
export const GOOGLE_CALENDAR_NAME = "Critical Path";

// calendar.events writes the events themselves. calendar.calendarlist.readonly is needed to find
// an existing "Critical Path" calendar by name. calendar.app.created lets us create that calendar
// when none exists. It is narrower than the full `calendar` scope.
export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
].join(" ");
