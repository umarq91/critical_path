"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  title: string;
  /** Inline content only (it renders inside a <p>) — text, <strong>, and the like. */
  description?: ReactNode;
  /** Block content under the description, e.g. a list of what the action covers. */
  children?: ReactNode;
  confirmLabel?: string;
  /** Delete is the common case; a non-destructive confirmation (e.g. "sync these") passes
   * "default" plus its own pendingLabel. */
  confirmVariant?: "destructive" | "default";
  pendingLabel?: string;
  onConfirm: () => Promise<void> | void;
  /** Use for a plain trigger element (e.g. a Button). Omit and use `open`/`onOpenChange`
   * instead when the trigger is a DropdownMenuItem — nesting a Dialog trigger inside a menu
   * that closes on click doesn't work reliably. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel = "Delete",
  confirmVariant = "destructive",
  pendingLabel = "Deleting…",
  onConfirm,
  trigger,
  open,
  onOpenChange,
  children,
}: ConfirmDialogProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="leading-snug">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children ? <div className="flex flex-col gap-3 px-5 pb-5">{children}</div> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={isPending}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
