// Rows per page on the Tasks grid and the Timeline (client request: up to 300). The server
// clamps to MAX_TASK_PAGE_SIZE too (see clampTaskPageSize), so a hand-edited ?pageSize= can't
// ask for more than the size selector offers.
export const MAX_TASK_PAGE_SIZE = 300;

export const TASK_PAGE_SIZE_OPTIONS = [15, 25, 50, 100, 200, MAX_TASK_PAGE_SIZE];

export function clampTaskPageSize(pageSize: number) {
  if (!Number.isInteger(pageSize) || pageSize < 1) return 1;
  return Math.min(pageSize, MAX_TASK_PAGE_SIZE);
}
