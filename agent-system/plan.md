# Plan -- extinguisher-tracker-3

**Current Phase**: 17 -- Inventory Bulk Delete and Pagination
**Last Updated**: 2026-03-23
**Author**: built_by_Beck

---

## Current Objective

1. Allow users to select multiple extinguishers at once for bulk deletion.
2. Add pagination to the Inventory page with options to show 10, 25, 50, or 100 items per page.

---

## Tasks for This Round (Phase 17)

### P17-01: Implement `batchSoftDeleteExtinguishers`
**File**: `src/services/extinguisherService.ts` (MODIFY)
Add a function to batch update multiple extinguisher documents with `deletedAt` and `deletedBy` fields, as well as a `deletedReason`.

### P17-02: Add Pagination to Inventory Page
**File**: `src/pages/Inventory.tsx` (MODIFY)
Introduce `currentPage` and `pageSize` state variables. Slice the `filtered` list to create `paginatedItems`. Add a pagination UI below the table to change pages and select the page size (10, 25, 50, 100).

### P17-03: Add Checkboxes and Selection State
**File**: `src/pages/Inventory.tsx` (MODIFY)
Add a `selectedIds` state (Set or Array of strings). Add a checkbox to each row to toggle selection, and a "Select All" checkbox in the header to select/deselect all items on the *current page*.

### P17-04: Implement Bulk Delete Action
**File**: `src/pages/Inventory.tsx` (MODIFY)
**File**: `src/components/extinguisher/DeleteConfirmModal.tsx` (MODIFY)
Add a "Bulk Delete" button when `selectedIds.length > 0`. Modify `DeleteConfirmModal` to optionally accept an array of asset IDs and update the text to say "Delete X extinguishers", then trigger the batch delete function.

### P17-05: Build & Lint
Run build scripts to verify everything is solid.