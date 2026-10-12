// Brand, Status, Gender and the overdue surfaces (Overdue panels/tiles, overdue row tint) are
// hidden across the app by client request, pending a later decision to bring them back. The
// columns, data and server-side logic are untouched — only rendering checks these flags, so
// flipping one to true restores that field everywhere it was shown. Every call site is listed
// in things-to-know.md § "Brand, Status, Gender & Overdue (hidden)".
export const TASK_FIELD_VISIBILITY: Record<"brand" | "status" | "gender" | "overdue", boolean> = {
  brand: false,
  status: false,
  gender: false,
  overdue: false,
};
