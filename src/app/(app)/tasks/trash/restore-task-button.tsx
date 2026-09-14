"use client";

import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { restoreTask } from "@/app/(app)/tasks/_actions";

// No confirmation dialog, unlike TaskRowActions' delete — restoring is the safe direction (it
// only ever un-hides a row that's already sitting in Trash), so it fires on a single click the
// same way RowEditToggle's confirm does.
export const RestoreTaskButton = ({ taskId, taskName }: { taskId: string; taskName: string }) => {
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreTask(taskId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${taskName} restored`);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRestore} disabled={isPending}>
      <RotateCcw />
      {isPending ? "Restoring…" : "Restore"}
    </Button>
  );
};
