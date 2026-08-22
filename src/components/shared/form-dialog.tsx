"use client";

import type { ReactElement, ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  title: string;
  description?: string;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Picks the dialog's max-width — match it to how much the form actually needs, not a
   *  blanket default: "sm" for a couple of fields, "md" (default) for a typical single-column
   *  form, "lg"/"xl" once fields start pairing up into two-column rows. */
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<FormDialogProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

export const FormDialog = ({ title, description, trigger, open, onOpenChange, className, size = "md", children }: FormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className={cn(SIZE_CLASSES[size], className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
};
