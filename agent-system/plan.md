# Plan -- extinguisher-tracker-3

**Current Phase**: 16 -- Delete Workspace & AI Knowledge Base
**Last Updated**: 2026-03-23
**Author**: built_by_Beck

---

## Current Objective

1. Allow users to permanently delete a workspace.
2. Provide the AI assistant with an internal knowledge base so it can answer questions about how to use the Extinguisher Tracker program.

---

## Tasks for This Round (Phase 16)

### P16-01: Implement `deleteWorkspace` Cloud Function
**File**: `functions/src/workspaces/deleteWorkspace.ts` (NEW)
**File**: `functions/src/index.ts` (MODIFY)
Create a new Cloud Function that recursively deletes a workspace document, its `inspections` subcollection, its `sectionNotes` subcollection, and its associated report document. Export it in `index.ts`.

### P16-02: Connect Delete Function to Frontend
**File**: `src/services/workspaceService.ts` (MODIFY)
Add `deleteWorkspaceCall` to trigger the backend function.

### P16-03: Add Delete UI to Workspaces Page
**File**: `src/pages/Workspaces.tsx` (MODIFY)
Add a "Delete" button (trash icon) to the workspace cards (perhaps primarily for archived workspaces, or both). Add a `ConfirmModal` (variant: danger) to confirm the deletion.

### P16-04: Implement AI Knowledge Base
**File**: `src/lib/aiKnowledgeBase.ts` (NEW)
Create a file exporting a constant string with instructions and FAQ for the AI about how to use the app (e.g., how to delete an extinguisher, how to import, how to manage workspaces).
**File**: `src/services/aiService.ts` (MODIFY)
Import the knowledge base and append it to the `SYSTEM_PROMPT`.

### P16-05: Build & Lint
Run build scripts to verify everything is solid.