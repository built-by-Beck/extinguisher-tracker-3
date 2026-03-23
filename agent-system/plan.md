# Plan -- extinguisher-tracker-3

**Current Phase**: 15 -- Add Location Hierarchy Level Indicators
**Last Updated**: 2026-03-23
**Author**: built_by_Beck

---

## Current Objective

The customer needs to know the hierarchy order of the locations in relation to their names. We need to add visual numbers beside the locations to show their level (e.g., top level = 1, next level = 2, etc.). 

---

## Project State Summary

- Phase 14 complete (Data Organizer, unified location mapping, real-time workspace tiles).
- Location tree views exist in `src/pages/Locations.tsx` and `src/pages/guest/GuestLocations.tsx`.
- Both views render an indented list using `depth` to calculate padding.

---

## Tasks for This Round (Phase 15)

### P15-01: Add level indicators to Admin Locations View
**File**: `src/pages/Locations.tsx` (MODIFY)
Update the `TreeNode` component to include a visual badge next to the location name, displaying "Level 1", "Level 2", etc., based on the `depth` prop (`depth + 1`).

### P15-02: Add level indicators to Guest Locations View
**File**: `src/pages/guest/GuestLocations.tsx` (MODIFY)
Update the `ReadOnlyTreeNode` component to include the same visual badge.

### P15-03: Build verification
Run `pnpm build` and `pnpm lint` to ensure no errors.
