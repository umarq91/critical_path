import { partyKey, type PartySummary } from "@/lib/party";
import type { Task } from "@/data/tasks";

type TaskParticipant = Task["participants"][number];

// task_participants rows carry a profile OR a department (never both — the table's check
// constraint guarantees it), and the UI wants one uniform shape for either. Rows whose joined
// record is missing are dropped rather than rendered blank: that only happens when the party
// was deleted out from under the task.
function toPartySummary(participant: TaskParticipant): PartySummary | null {
  if (participant.department) {
    const { id, name, description, is_external } = participant.department;
    return {
      kind: "department",
      id,
      key: partyKey({ kind: "department", id }),
      name,
      subtitle: is_external ? "External · no platform users" : description,
      avatarUrl: null,
      isExternal: is_external,
    };
  }

  if (participant.profile) {
    const { id, full_name, email, avatar_url, department } = participant.profile;
    return {
      kind: "user",
      id,
      key: partyKey({ kind: "user", id }),
      name: full_name ?? email,
      subtitle: department ? `${email} · ${department.name}` : email,
      avatarUrl: avatar_url,
      isExternal: false,
    };
  }

  return null;
}

function partiesForRole(task: Task, role: TaskParticipant["role"]): PartySummary[] {
  return task.participants
    .filter((participant) => participant.role === role)
    .flatMap((participant) => {
      const party = toPartySummary(participant);
      return party ? [party] : [];
    })
    // Departments first, then people, matching the picker's own ordering so a task reads the
    // same way everywhere it's rendered.
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "department" ? -1 : 1));
}

export function taskOwners(task: Task) {
  return partiesForRole(task, "owner");
}

export function taskPeopleInvolved(task: Task) {
  return partiesForRole(task, "involved");
}
