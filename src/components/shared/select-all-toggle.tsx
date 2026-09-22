"use client";

interface SelectAllToggleProps {
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

// Paired "Select all" / "Deselect all" links for a checklist header — every export dialog's
// column picker (tasks, brands, seasons, key stages, dashboard's Task Records) drives its
// column Set through this same control rather than each re-implementing the two buttons.
export const SelectAllToggle = ({ onSelectAll, onDeselectAll }: SelectAllToggleProps) => {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSelectAll}
        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Select all
      </button>
      <span className="text-xs text-muted-foreground">·</span>
      <button
        type="button"
        onClick={onDeselectAll}
        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Deselect all
      </button>
    </div>
  );
};
