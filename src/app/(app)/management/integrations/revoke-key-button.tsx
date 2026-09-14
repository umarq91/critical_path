"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeApiKey } from "@/app/(app)/management/integrations/_actions";

// A single destructive action, unlike TaskRowActions' dropdown — no other row action exists
// here (a revoked key can't be un-revoked, edited, or deleted), so a plain button is enough.
export const RevokeKeyButton = ({ keyId, keyName }: { keyId: string; keyName: string }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleRevoke() {
    const result = await revokeApiKey(keyId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${keyName} revoked`);
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
        Revoke
      </Button>
      <ConfirmDialog
        title="Revoke API key"
        description={`Anything using "${keyName}" will immediately lose access. This can't be undone — a new key would need to be issued.`}
        confirmLabel="Revoke"
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleRevoke}
      />
    </>
  );
};
