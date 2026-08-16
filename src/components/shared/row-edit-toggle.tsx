"use client";

import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RowEditToggleProps {
  isEditing: boolean;
  isSaving?: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}

export const RowEditToggle = ({ isEditing, isSaving, onEdit, onConfirm }: RowEditToggleProps) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isSaving}
      onClick={(event) => {
        event.stopPropagation();
        if (isEditing) onConfirm();
        else onEdit();
      }}
      aria-label={isEditing ? "Save changes" : "Edit row"}
    >
      {isEditing ? <Check className="text-status-complete-text" /> : <Pencil />}
    </Button>
  );
};
