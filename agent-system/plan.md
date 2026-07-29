# Plan — Detailed Location Picker + Floor Navigation

**Status:** ACCEPTED WITH MINOR CONCERNS — denorm floor preserve fixed  
**Branch:** `cursor/detailed-location-picker-d60b`  
**Classification:** LARGE  
**Author:** built_by_Beck

## Done
1. DetailedLocationPicker + locationService derive/scope/seed helpers
2. Wired ExtinguisherForm, Custom Assets, Inventory, DataOrganizer
3. Building edit idempotent floor seeding
4. WorkspaceDetail collapsible scope overview + floor-aware grouping/sort
5. PrintableList multi-location + detailed columns + CSV
6. GettingStarted locations step updated

## Review checklist
- Org-scoped queries only; no privileged field writes from client beyond existing patterns
- Custom asset floor/vicinity optional fields do not weaken rules
- Print/CSV does not leak cross-tenant data
- Compat floor grouping does not double-count hierarchy floors

## Deferred
- Email invite delivery
- Multi-inspector presence/locks
- Server-side inventory PDF
- Bulk migrate extinguishers onto floor locationIds
