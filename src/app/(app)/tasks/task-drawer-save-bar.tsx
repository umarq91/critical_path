"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParticipantsDraft } from "@/app/(app)/tasks/use-participants-draft";

// Only rendered while there is something to confirm — a permanently visible Save bar on a
// drawer that is otherwise read-only reads as "this form is unsaved" when nothing is pending.
export const TaskDrawerSaveBar = ({ draft }: { draft: ParticipantsDraft }) => {
  if (!draft.isDirty) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3">
      <span className="text-sm text-muted-foreground">Unsaved changes to owners or people involved</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={draft.discard} disabled={draft.isSaving}>
          Cancel
        </Button>
        <Button size="sm" onClick={draft.save} disabled={draft.isSaving}>
          {draft.isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </div>
    </div>
  );
};
