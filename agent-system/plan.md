# Plan -- extinguisher-tracker-3

**Current Phase**: 9 -- Unify Locations & Sections + Fix WorkspaceDetail Location Cards
**Last Updated**: 2026-03-19
**Author**: built_by_Beck

---

## Current Objective

Fix two related issues:
1. **Location cards not showing in WorkspaceDetail** — the cards render but show "No locations configured" because the data sources are mismatched.
2. **Locations page and Sections in OrgSettings are disconnected** — two independent systems that should be the same thing.

Unify them so there is ONE source of truth for locations/sections, and make WorkspaceDetail location cards work correctly.

---

## Diagnosis

### Issue 1: Why Location Cards Don't Show in WorkspaceDetail

**Root cause: The `section` field on extinguishers (and therefore inspections) is empty/mismatched with `org.settings.sections`.**

Here's the data flow:

1. **WorkspaceDetail** (line 58) reads `sections` from `org?.settings?.sections ?? []`
2. **`allSections`** (line 169-176) builds a union of `org.settings.sections` + sections found on inspection docs (`insp.section || 'Unassigned'`)
3. **`sectionStatsMap`** (line 138-165) counts inspections per section
4. **Location cards render** (line 392) when `selectedSection === null` — they show `allSections`

The cards WILL render if `allSections` has items. The "No locations configured" empty state shows when `allSections.length === 0`.

**This happens when:**
- `org.settings.sections` is an empty array (user never added sections in OrgSettings)
- AND every inspection has an empty `insp.section` string (so they all become "Unassigned")

Wait — the review-agent already fixed the "Unassigned" bug (agents-info.md line 17), so inspections with blank sections DO get counted under "Unassigned" and "Unassigned" IS added to `allSections`. So if there are ANY inspections, at least "Unassigned" should appear.

**Possible remaining causes:**
- If the user DID add locations on the Locations page but NOT sections in OrgSettings, then `org.settings.sections` is empty AND the extinguishers' `section` field is empty (because the Locations page writes to `org/{orgId}/locations` collection, NOT to `org.settings.sections`). All inspections would have `section: ''`, producing one "Unassigned" card.
- The user may have expected their Locations page entries to show as location cards, but they don't — because WorkspaceDetail reads from `org.settings.sections`, not from the `locations` collection.

**Conclusion for Issue 1:** The location cards DO technically work (the "Unassigned" fix ensures at least one card appears), but they only show org.settings.sections + "Unassigned". The user likely added locations on the Locations page and expected those to appear as location cards in WorkspaceDetail. They don't, because these are two separate systems. This is really Issue 2 manifesting in the UI.

### Issue 2: Two Disconnected Location Systems

**System A: OrgSettings Sections**
- Stored at: `org/{orgId}.settings.sections` (string array)
- Managed by: OrgSettings page (add/remove simple strings)
- Used by: WorkspaceDetail (location cards), Inspection docs (`section` field), ExtinguisherDetail (section display)

**System B: Locations Collection**
- Stored at: `org/{orgId}/locations` (full documents with hierarchy)
- Managed by: Locations page (CRUD with tree view, types, parent/child)
- Used by: Extinguisher docs (`locationId` field), ExtinguisherDetail (location display)
- Has fields: name, locationType, parentLocationId, section, description, address, gps

These are completely independent. The Locations page has a `section` field on each location doc, but that's a freetext input — it doesn't sync to/from `org.settings.sections`.

**What the user wants:** ONE unified concept. When you add a location, it shows up everywhere — in the Locations page tree view, in OrgSettings, in WorkspaceDetail location cards, and on extinguisher/inspection section fields.

---

## Unification Strategy

**Make the `locations` collection the single source of truth.** Remove `org.settings.sections` as a separate concept.

**Why locations collection wins over sections array:**
- Locations have richer data (hierarchy, types, descriptions, addresses)
- Locations already have CRUD operations
- Locations have a proper Firestore collection (not a nested array on the org doc)
- The sections array is just a flat list of strings — a subset of what locations already provides
- The Locations page already exists with a proper UI

**Approach:**
1. WorkspaceDetail location cards should read from the `locations` collection, not `org.settings.sections`
2. Extinguisher `section` field should be populated from location names (or locationId lookups)
3. Inspection `section` field (copied from extinguisher at workspace creation) drives the grouping
4. OrgSettings "Sections" card either gets removed or becomes a read-only view / redirect to Locations page
5. Migration: existing `org.settings.sections` values should be importable as locations

---

## Tasks for This Round

### Subsystem A: WorkspaceDetail — Use Locations Collection for Cards

**P9-01: Subscribe to locations in WorkspaceDetail and use them for location cards**
- File: `src/pages/WorkspaceDetail.tsx`
- Import `subscribeToLocations` from `../services/locationService.ts`
- Add a `useEffect` that subscribes to locations for the org (same pattern as Locations.tsx)
- Change `allSections` computation:
  - Start with location names from the locations collection (not `org.settings.sections`)
  - Still merge in any `insp.section` values found on inspections (for backward compat with existing data)
  - Still include "Unassigned" for inspections with empty section
- Change `sectionStatsMap` to initialize from location names instead of `org.settings.sections`
- This means location cards will show location names from the collection
- Location cards still group inspections by matching `insp.section` to location names
- Remove the dependency on `org.settings.sections` (or keep as fallback if locations collection is empty)

**P9-02: Show location metadata on location cards**
- File: `src/pages/WorkspaceDetail.tsx`
- Since we now have full Location objects (not just strings), enhance the cards:
  - Show location type badge (e.g., "Building", "Floor") in small text
  - Show description snippet if available
- Create a `Map<string, Location>` from the locations array for quick lookup by name
- This is a polish task — can be deferred if time is tight

### Subsystem B: Unify the Section Field on Extinguishers

**P9-03: Update extinguisher form to select from locations collection**
- Files to check: `src/pages/ExtinguisherForm.tsx` or wherever extinguisher create/edit lives
- The `section` field on extinguishers should be populated from a dropdown of location names (from the locations collection), NOT a freetext input
- Also consider populating `locationId` with the selected location's doc ID
- When the user picks a location, set both `section = location.name` and `locationId = location.id`
- This ensures new extinguishers have section values that match location names

**P9-04: Update createWorkspace Cloud Function — section field source**
- File: `functions/src/workspaces/createWorkspace.ts`
- Currently line 89: `section: extData.section ?? ''`
- This copies the extinguisher's `section` field to the inspection doc
- No change needed here IF we fix P9-03 (extinguisher section now matches location names)
- BUT: if existing extinguishers have empty section fields, their inspections will still be "Unassigned"
- Add a comment documenting that inspection.section comes from extinguisher.section at workspace creation time

### Subsystem C: OrgSettings Sections — Redirect to Locations

**P9-05: Replace OrgSettings "Sections" card with a link to Locations page**
- File: `src/pages/OrgSettings.tsx`
- Remove the sections management UI (the add/remove string chips)
- Replace with an info card that says "Manage your locations and sections on the Locations page" with a link/button to navigate to `/dashboard/locations`
- Keep `org.settings.sections` in Firestore for backward compatibility (don't delete the field)
- Remove `sections` from the `handleSave` update (stop writing to `settings.sections`)
- Eventually (future cleanup) `org.settings.sections` can be deprecated entirely

**P9-06: Remove `sections` state management from OrgSettings**
- File: `src/pages/OrgSettings.tsx`
- Remove: `const [sections, setSections]`, `const [newSection, setNewSection]`, `handleAddSection`, `handleRemoveSection`
- Remove `'settings.sections': sections` from the `handleSave` updateDoc call
- Clean up unused imports (`Plus`, `X` if only used for sections)

### Subsystem D: Locations Page — Remove Redundant "Section" Field

**P9-07: Remove the "Section" freetext field from the Location form**
- File: `src/pages/Locations.tsx`
- The Location form currently has a "Section" input (line 304-312) — this is confusing because the location IS the section now
- Remove the "Section" field from the create/edit form
- The location's `name` IS the section/location identifier
- Keep `section` on the Location interface for backward compat but don't show it in the form

### Subsystem E: Backward Compatibility — Migration Helper

**P9-08: Add a one-time migration utility (optional, low priority)**
- If an org has values in `org.settings.sections` but no locations in the collection, offer to import them
- This could be a button on the Locations page: "Import sections from settings"
- Or it could be automatic: on Locations page load, if `locations.length === 0 && org.settings.sections.length > 0`, show a prompt
- Each imported section becomes a Location doc with `name = sectionName`, `locationType = 'zone'`, `parentLocationId = null`
- **This is a nice-to-have. Skip if time is tight.**

### Subsystem F: Verification

**P9-09: TypeScript build verification**
- Run `pnpm build` — fix any TypeScript errors
- Run `cd functions && npm run build` — fix any backend errors
- Verify no broken imports from removed code

**P9-10: End-to-end flow testing checklist**
- **Locations page**: Add a location → appears in tree
- **WorkspaceDetail**: Open workspace → location cards show locations from the collection (not org.settings.sections)
- **WorkspaceDetail**: Inspections grouped correctly by section (matching location names)
- **WorkspaceDetail**: "Unassigned" card appears for inspections with empty/non-matching section
- **WorkspaceDetail**: Click a location card → see extinguisher cards for that section
- **OrgSettings**: Sections card replaced with "Go to Locations" link
- **OrgSettings**: Save still works for other fields (name, timezone)
- **ExtinguisherDetail**: Section/location info still displays correctly
- **Extinguisher create/edit**: Section dropdown populated from locations collection
- **Existing data**: Extinguishers with old section values still show under matching or "Unassigned" cards

---

## Task Order

**Round 1 — Core fix (unblocks the visible bug):**
1. P9-01: WorkspaceDetail reads locations collection for cards
2. P9-05: OrgSettings sections card → redirect to Locations
3. P9-06: Remove sections state from OrgSettings

**Round 2 — Consistency (ensures new data is correct):**
4. P9-03: Extinguisher form uses location dropdown
5. P9-07: Remove "Section" field from Location form

**Round 3 — Polish:**
6. P9-02: Location metadata on cards (optional)
7. P9-04: Comment in createWorkspace (trivial)
8. P9-08: Migration utility (optional)

**Round 4 — Verification:**
9. P9-09: TypeScript build
10. P9-10: E2E testing

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P9-01 | None |
| P9-02 | P9-01 |
| P9-03 | P9-01 (so the dropdown data source is clear) |
| P9-04 | None |
| P9-05 | None |
| P9-06 | P9-05 |
| P9-07 | None |
| P9-08 | P9-01, P9-05 |
| P9-09 | All prior tasks |
| P9-10 | All prior tasks |

---

## Blockers or Risks

1. **Existing data mismatch**: Extinguishers created before this change have `section` values that may not match location names. These will appear under "Unassigned" or under a card if the name happens to match. This is acceptable — no data migration is required, just a UI that handles both cases.

2. **Inspection section is set at workspace creation time**: Changing the extinguisher's section after a workspace is created does NOT retroactively update existing inspection docs. This is by design (inspections are snapshots). Future workspaces will pick up the new section.

3. **Location names are not unique**: The locations collection doesn't enforce unique names. If two locations have the same name, their inspections will be grouped together on the location card. The build-agent should be aware but this is an edge case that can be addressed later.

4. **`org.settings.sections` still exists in Firestore**: We stop writing to it but don't delete it. Old data remains. This avoids needing a backend migration. The `OrgSettings` type still has the field. WorkspaceDetail's fallback can optionally read it if no locations exist.

5. **The `section` field on the Location interface**: Currently a freetext field. We're removing it from the form (P9-07) but keeping it on the interface. The location's `name` IS now the section identifier. We should NOT use `location.section` for grouping — use `location.name` instead.

6. **Extinguisher `section` vs `locationId`**: Extinguishers have both `section` (string, used by inspections) and `locationId` (reference to locations collection). The `section` string is what gets copied to inspection docs at workspace creation. The `locationId` is a richer reference. P9-03 should set BOTH when creating/editing extinguishers.

---

## Definition of Done

Phase 9 is complete when ALL of the following are true:

1. **WorkspaceDetail location cards** show locations from the `locations` collection (not `org.settings.sections`)
2. **WorkspaceDetail location cards** correctly group inspections by matching `insp.section` to location names
3. **"Unassigned" card** appears for inspections whose section doesn't match any location name
4. **OrgSettings** no longer has a sections management UI — replaced with link to Locations page
5. **Extinguisher create/edit** populates `section` from a location name dropdown
6. **Location form** no longer has a confusing "Section" freetext input
7. **TypeScript compiles clean** — `pnpm build` and `cd functions && npm run build` pass
8. **Existing data** is handled gracefully (no crashes, mismatched sections show as Unassigned)

---

## Handoff to build-agent

**Start with P9-01** — this is the highest-impact fix. It makes WorkspaceDetail location cards pull from the locations collection, which immediately fixes the "nothing showing" bug for users who have locations but no org.settings.sections.

**Then P9-05 + P9-06** — remove the confusing sections UI from OrgSettings. Replace with a link to Locations.

**Then P9-03 + P9-07** — ensure new data flows correctly (extinguisher section from location dropdown, remove redundant Section field from location form).

**Key context:**

- **`subscribeToLocations(orgId, callback)`** already exists in `src/services/locationService.ts`. It returns active (non-deleted) locations sorted by sortOrder. Use this in WorkspaceDetail.

- **Inspection `section` field** (on the `Inspection` interface) is a string set at workspace creation time by copying `extinguisher.section`. This is the grouping key for location cards. The location cards match `insp.section` to location names.

- **The locations collection has a `name` field** — this is what should be used as the "section" identifier. Do NOT use `location.section` (which is a separate freetext field that's being deprecated).

- **Backward compat**: Some inspections will have section values that don't match any location name (from before unification). These go into "Unassigned". Some inspections will have empty section strings. These also go into "Unassigned".

- **`allSections` computation** should be: `Set(location names from collection) UNION Set(insp.section values from inspections)`. This ensures all inspection data is visible even if a location was deleted.

- **`org.settings.sections`**: Stop reading it in WorkspaceDetail (or use as fallback only if locations collection is empty AND sections array is non-empty). Stop writing it in OrgSettings.

- **Design**: Keep the same Tailwind card style. Location cards already look great. Just change the data source.

**Warnings from lessons-learned:**
- Never call `DocumentReference.update()` on non-existent doc.
- No `any` types. TypeScript strict mode.
- Always include `built_by_Beck` in commit messages.
- Use explicit parentheses with mixed `&&` / `||`.
- When a useEffect fetches async data, reset state at the top of the effect.
- After mutations, refresh derived data lists.

---

## Phase History (Reference)

### Phase 1 -- Foundation (COMPLETE)
All 28 tasks.

### Phase 2 -- Core Operations & Billing (COMPLETE)
26 tasks.

### Phase 3 -- Workspaces & Inspections (COMPLETE)
Workspaces, Inspections, InspectionForm, WorkspaceDetail.

### Phase 4 -- Reminders, Compliance Engine, Lifecycle Engine (COMPLETE)
25 tasks.

### Phase 5 -- Reports & Audit Logs (COMPLETE)
14 tasks.

### Phase 6 -- Offline Sync (COMPLETE)
24 tasks.

### Phase 7 -- Guest Access (COMPLETE)
25 tasks.

### Phase 8 -- Barcode Scanner & Quick Inspection (COMPLETE)
20 tasks. WorkspaceDetail drill-down rewrite also done.
