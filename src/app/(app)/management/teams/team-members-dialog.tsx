"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { USER_STATUS_CONFIG } from "@/constants/user-account";
import {
  addTeamMember,
  listTeamMembers,
  removeTeamMember,
  searchTeamCandidates,
} from "@/app/(app)/management/teams/_actions";
import type { DepartmentMember } from "@/data/departments";
import type { SearchedProfile } from "@/data/profiles";

const SEARCH_DEBOUNCE_MS = 200;

interface TeamMembersDialogProps {
  departmentId: string;
  departmentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TeamMembersDialog = ({ departmentId, departmentName, open, onOpenChange }: TeamMembersDialogProps) => {
  const [members, setMembers] = useState<DepartmentMember[] | null>(null);
  const [candidates, setCandidates] = useState<SearchedProfile[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  // Every setState sits inside a promise callback, never in the effect body — the same shape
  // as tasks/party-search-dropdown.tsx. A synchronous setState during the effect (including
  // via an awaited helper) is a cascading render, which react-hooks/set-state-in-effect
  // rejects. `reloadToken` is how add/remove re-run this from an event handler.
  //
  // No reset to null on re-run either: the board mounts this only while a department is
  // selected, so the first open already starts at `members === null`.
  useEffect(() => {
    let cancelled = false;

    listTeamMembers(departmentId)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error);
          setMembers([]);
          return;
        }
        setMembers(result.data);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [departmentId, reloadToken]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    searchTeamCandidates({ query: debouncedQuery || undefined })
      .then((result) => {
        if (cancelled) return;
        setCandidates(result.ok ? result.data : []);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery]);

  async function handleAdd(profile: SearchedProfile) {
    setBusyId(profile.id);
    const result = await addTeamMember(departmentId, profile.id);
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${profile.full_name ?? profile.email} added to ${departmentName}`);
    setReloadToken((token) => token + 1);
  }

  async function handleRemove(member: DepartmentMember) {
    setBusyId(member.id);
    const result = await removeTeamMember(departmentId, member.id);
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${member.full_name ?? member.email} removed from ${departmentName}`);
    setReloadToken((token) => token + 1);
  }

  const memberIds = new Set((members ?? []).map((member) => member.id));
  // Filtered here rather than in the query: the server deliberately returns people already in
  // another department (moving between teams is normal), and only this department's own
  // members are meaningless to offer.
  const addableCandidates = candidates.filter((candidate) => !memberIds.has(candidate.id));

  return (
    <FormDialog
      title={`Members of ${departmentName}`}
      description="A person belongs to one department at a time — adding someone who is already on another team moves them."
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-label text-text-secondary">
            Current members {members ? `(${members.length})` : ""}
          </h3>
          <div className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {members === null ? (
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : members.length === 0 ? (
              <p className="p-4 text-body text-muted-foreground">
                Nobody is in this department yet. A department with no members is a normal state —
                Vendor and Supplier will never have logins.
              </p>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong text-foreground">
                      {member.full_name ?? member.email}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{member.email}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {member.status !== "active" ? (
                      <StatusBadge value={member.status} config={USER_STATUS_CONFIG} />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${member.full_name ?? member.email} from ${departmentName}`}
                      disabled={busyId === member.id}
                      onClick={() => void handleRemove(member)}
                    >
                      {busyId === member.id ? <Loader2 className="animate-spin" /> : <X />}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-label text-text-secondary">Add a member</h3>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or email..."
              className="h-9 pl-8"
              aria-label="Search for a user to add"
            />
          </div>
          <div className="flex max-h-56 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {addableCandidates.length === 0 ? (
              <p className="p-4 text-body text-muted-foreground">
                {query ? "No users match that search." : "Everyone found is already on this team."}
              </p>
            ) : (
              addableCandidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-body-strong text-foreground">
                      {candidate.full_name ?? candidate.email}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {candidate.department ? `${candidate.email} · currently in ${candidate.department.name}` : candidate.email}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={busyId === candidate.id}
                    onClick={() => void handleAdd(candidate)}
                  >
                    {busyId === candidate.id ? <Loader2 className="animate-spin" /> : <Plus />}
                    {candidate.department ? "Move" : "Add"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </FormDialog>
  );
};
