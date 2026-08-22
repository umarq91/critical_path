"use server";

import { getCurrentProfile } from "@/data/profiles";
import { listUpcomingTasksForProfile, type ListTasksParams } from "@/data/tasks";

// Powers the isolated "Refresh" icon on the Upcoming Tasks table (see useRefreshableData) —
// same pattern as tasks/_actions.ts's refreshTasks, just scoped to the signed-in profile.
// profileId is resolved server-side, never taken from the client, so a request can't be
// crafted to refresh someone else's upcoming tasks.
export async function refreshUpcomingTasks(params: ListTasksParams) {
  const profile = await getCurrentProfile();
  if (!profile) return { data: [], rowCount: 0 };
  return listUpcomingTasksForProfile(profile.id, params);
}
