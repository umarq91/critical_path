"use client";

import { useState } from "react";

// One row editable at a time — starting a second row's edit silently discards the first
// row's unsaved draft. Generic across tables: caller decides which fields go into the
// draft (via startEditing) and what "confirm" does (typically a Server Action call).
export function useRowEditing() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  function startEditing(id: string, initialDraft: Record<string, string>) {
    setEditingId(id);
    setDraft(initialDraft);
  }

  function setDraftField(field: string, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function stopEditing() {
    setEditingId(null);
    setDraft({});
  }

  return {
    editingId,
    draft,
    isEditing: (id: string) => editingId === id,
    startEditing,
    setDraftField,
    stopEditing,
  };
}

export type RowEditingState = ReturnType<typeof useRowEditing>;
