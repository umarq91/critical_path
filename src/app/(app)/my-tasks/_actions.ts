"use server";

import { getCurrentProfile } from "@/data/profiles";
import { listTasksForProfile, type ListTasksParams } from "@/data/tasks";

// Powers the isolated "Refresh" icon on the My Tasks table (see useRefreshableData) — same
// pattern as tasks/_actions.ts's refreshTasks, just scoped to the signed-in profile. profileId
// is resolved server-side, never taken from the client, so a request can't be crafted to
// refresh someone else's tasks.
export async function refreshMyTasks(params: ListTasksParams) {
  const profile = await getCurrentProfile();
  if (!profile) return { data: [], rowCount: 0 };
  return listTasksForProfile(profile.id, params);
}
