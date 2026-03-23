# Plan -- extinguisher-tracker-3

**Current Phase**: 14 -- Import UX Polish, Reports Generate Button, Data Organizer, Export Backup
**Last Updated**: 2026-03-23
**Author**: built_by_Beck

---

## Current Objective

Five improvements: (1) rename "Import File" button to "Import", (2) fix import validation — make `serial` optional, keep `assetId` required, add `location` awareness in the column mapper, (3) add a "Generate Report" button to the Reports page, (4) create a new Data Organizer page/tab for organizing incomplete imported data, (5) add JSON backup export functionality.

---

## Project State Summary

- **Phases 1-13**: Complete (Foundation through Duplicate Detection + Data Import)
- **ImportExportBar** (`src/components/extinguisher/ImportExportBar.tsx`) — file import supporting CSV, XLS/XLSX, JSON, TXT with column mapper modal
- **ColumnMapperModal** (`src/components/extinguisher/ColumnMapperModal.tsx`) — maps user columns to EX3 fields; currently marks `assetId` and `serial` as required
- **importCSV Cloud Function** (`functions/src/data/importCSV.ts`) — backend skips rows where `!row.assetId || !row.serial`; error message says "Ensure headers include assetId and serial"
- **Reports page** (`src/pages/Reports.tsx`) — lists archived workspace reports with download buttons per format (CSV, PDF, JSON)
- **generateReport Cloud Function** (`functions/src/reports/generateReport.ts`) — already exported and callable; generates CSV/PDF/JSON for archived workspaces
- **ReportDownloadButton** (`src/components/reports/ReportDownloadButton.tsx`) — triggers `generateReport` for a specific workspace + format
- **Locations service** (`src/services/locationService.ts`) — `subscribeToLocations`, `Location` type with `id`, `name`, `locationType`, `parentLocationId`
- **Extinguisher type** (`src/services/extinguisherService.ts`) — has `locationId`, `parentLocation`, `section`, `vicinity` for location tracking
- **Routing** (`src/routes/index.tsx`) — all dashboard routes under `/dashboard/*`; sidebar in `src/components/layout/Sidebar.tsx`
- **DataImportModal** (`src/components/extinguisher/DataImportModal.tsx`) — existing JSON import modal

---

## Tasks for This Round (Phase 14)

### P14-01: Rename "Import File" button to "Import"

**File**: `src/components/extinguisher/ImportExportBar.tsx` (MODIFY)

Simple text change on line 263:
- Change `Import File` to `Import`
- Keep the `<Upload>` icon, keep `accept={ACCEPTED_EXTENSIONS}` unchanged (CSV, XLS/XLSX, JSON, TXT all still supported)

**Definition of done**: Button reads "Import" instead of "Import File". All 4 file types still accepted.

---

### P14-02: Make `serial` optional in ColumnMapperModal

**File**: `src/components/extinguisher/ColumnMapperModal.tsx` (MODIFY)

Change the `serial` entry in `TARGET_FIELDS` from `required: true` to `required: false`.

Add a new `location` target field entry to help users map location data. Insert after `serial`:

```typescript
{
  key: 'locationName',
  label: 'Location Name',
  required: false,
  aliases: [
    'location', 'location name', 'location_name', 'locationname',
    'building', 'building name', 'building_name', 'buildingname',
    'facility', 'site', 'campus', 'property',
  ],
},
```

Wait — `parentLocation` and `locationId` fields already exist in `TARGET_FIELDS` (lines 122-137). So location mapping is already supported. The key change is:
1. Change `serial` from `required: true` to `required: false`
2. Add a visual indicator or reorder to make location fields more prominent — move `parentLocation` (Building / Location) higher in the list, right after `serial`, to make it more visible since it's important for organization.

Actually, re-reading the requirement: "Location should also be added as an important field since extinguishers need to track to the Locations tab." The `parentLocation` and `locationId` fields are already there but are buried at positions 11-12 of 14. Promote them by:
- Moving `parentLocation` to position 3 (after `serial`)
- Moving `locationId` to position 4 (after `parentLocation`)
- Add a visual hint in the mapper UI: show a small "Important" label on fields that are commonly needed (assetId, serial, parentLocation, locationId)

Revised approach (keep it simple — no UI redesign):
1. Change `serial.required` to `false`
2. Reorder `TARGET_FIELDS`: move `parentLocation` to index 2 (after serial) and `locationId` to index 3

**Definition of done**: `serial` is optional in the mapper. Location fields appear prominently near the top.

---

### P14-03: Make `serial` optional in backend Cloud Function

**File**: `functions/src/data/importCSV.ts` (MODIFY)

Three changes:

1. **`CSVRow` interface** (line 12): Change `serial: string` to `serial?: string`

2. **`parseCSV` function** (line 41): Change `if (!row.assetId || !row.serial) continue;` to `if (!row.assetId) continue;` — only skip rows missing assetId.

3. **Error message** (line 84): Change `'CSV contains no valid rows. Ensure headers include assetId and serial.'` to `'CSV contains no valid rows. Ensure headers include assetId.'`

4. **Document write** (line 139): Change `serial: row.serial,` to `serial: row.serial || '',` — default to empty string if serial not provided.

**Definition of done**: Backend accepts CSV files without `serial` column. Rows only require `assetId`. Serial defaults to empty string.

---

### P14-04: Add "Generate Report" button to Reports page

**File**: `src/pages/Reports.tsx` (MODIFY)

The existing Reports page shows archived workspace reports with download buttons. The "Generate Report" button should let users select an archived workspace and format, then call `generateReport`.

Approach: Add a "Generate Report" section at the top of the page with:
- A dropdown to select from existing archived workspaces (from the `reports` list already loaded)
- Format selector (CSV, PDF, JSON radio buttons or dropdown)
- A "Generate" button that calls `generateReportDownload` from `reportService.ts`
- Loading state and error/success feedback

Implementation:

```typescript
// Add to imports
import { Download } from 'lucide-react';
import { generateReportDownload } from '../services/reportService.ts';
import type { ReportFormat } from '../types/report.ts';

// Add state
const [genWorkspaceId, setGenWorkspaceId] = useState('');
const [genFormat, setGenFormat] = useState<ReportFormat>('pdf');
const [generating, setGenerating] = useState(false);
const [genError, setGenError] = useState('');

// Add handler
async function handleGenerate() {
  if (!orgId || !genWorkspaceId) return;
  setGenerating(true);
  setGenError('');
  try {
    const { downloadUrl } = await generateReportDownload(orgId, genWorkspaceId, genFormat);
    window.open(downloadUrl, '_blank');
  } catch (err) {
    setGenError(err instanceof Error ? err.message : 'Failed to generate report.');
  } finally {
    setGenerating(false);
  }
}
```

Add a card above the report list with:
- "Generate Report" heading
- Workspace dropdown (populated from `reports` array — `report.workspaceId` as value, `report.label` as label)
- Format dropdown/selector
- Generate button
- Error display

**Definition of done**: Users can select a workspace + format and generate/download a report from the Reports page header area.

---

### P14-05: Create Data Organizer page

**Files**:
- `src/pages/DataOrganizer.tsx` (NEW) — main page component
- `src/routes/index.tsx` (MODIFY) — add route
- `src/components/layout/Sidebar.tsx` (MODIFY) — add nav item

This is the most complex task. The Data Organizer helps users fix incomplete imported data.

**Page layout**:
1. **Summary banner**: Show counts of extinguishers with issues (no location, no serial, no type, etc.)
2. **Filter bar**: Filter by issue type (missing location, missing serial, missing type, etc.) or show all incomplete
3. **Editable table**: Show extinguishers with incomplete data in an inline-editable table
4. **Bulk location assign**: Select multiple rows + pick a location from dropdown → bulk update `locationId` and `parentLocation`

**Data flow**:
- Subscribe to all active extinguishers via `subscribeToExtinguishers(orgId, callback, { noLimit: true })`
- Filter client-side for those with missing fields
- Location dropdown populated from `subscribeToLocations`
- Updates use `updateDoc` from `extinguisherService.ts` (need to add `updateExtinguisher` if not already exported)

**Issue detection criteria** (an extinguisher is "incomplete" if ANY of these):
- `locationId` is null AND `parentLocation` is empty → "No location"
- `serial` is empty → "No serial"
- `extinguisherType` is null → "No type"
- `manufactureYear` is null → "No manufacture year"
- `extinguisherSize` is null → "No size"

**Editable table columns**:
- Checkbox (for bulk select)
- Asset ID (read-only link to detail page)
- Serial (editable inline text input)
- Type (editable dropdown)
- Size (editable dropdown)
- Location (editable dropdown from locations list)
- Section (editable text)
- Issues (badge list of what's missing)
- Save button per row

**Bulk actions bar** (shown when rows selected):
- "Assign Location" dropdown + apply button
- "Assign Section" text input + apply button
- Selected count indicator

**Implementation detail**:

```typescript
// State
const [extinguishers, setExtinguishers] = useState<Extinguisher[]>([]);
const [locations, setLocations] = useState<Location[]>([]);
const [selected, setSelected] = useState<Set<string>>(new Set());
const [edits, setEdits] = useState<Record<string, Partial<Extinguisher>>>({});
const [saving, setSaving] = useState<Set<string>>(new Set());
const [issueFilter, setIssueFilter] = useState<string>('all');

// Computed
const incomplete = useMemo(() => extinguishers.filter(ext => {
  const issues = getIssues(ext);
  if (issues.length === 0) return false;
  if (issueFilter === 'all') return true;
  return issues.includes(issueFilter);
}), [extinguishers, issueFilter]);
```

Need to check if `updateExtinguisher` exists or if we need `updateDoc` directly.

**Routing**: `/dashboard/data-organizer`

**Sidebar**: Add between "Inventory" and "Locations":
```typescript
{ to: '/dashboard/data-organizer', label: 'Data Organizer', icon: Wrench, end: false, roles: ['owner', 'admin'] },
```
Use `Wrench` icon from lucide-react (or `ListChecks` or `ClipboardCheck`).

**Definition of done**:
- New page at `/dashboard/data-organizer` accessible from sidebar
- Shows all extinguishers with incomplete data
- Inline editing for serial, type, size, location, section
- Bulk location assignment for selected rows
- Save individual rows or bulk-apply changes
- Issue badges showing what's missing per row
- Only visible to owner/admin roles

---

### P14-06: Add extinguisher update service function

**File**: `src/services/extinguisherService.ts` (MODIFY)

Check if an `updateExtinguisher` function already exists. If not, add:

```typescript
/**
 * Update specific fields on an extinguisher document.
 */
export async function updateExtinguisher(
  orgId: string,
  extId: string,
  data: Partial<Omit<Extinguisher, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  const ref = doc(db, 'org', orgId, 'extinguishers', extId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
```

Also add a batch update function for bulk operations:

```typescript
/**
 * Batch update multiple extinguishers with partial data.
 * Chunks to 499 operations per batch.
 */
export async function batchUpdateExtinguishers(
  orgId: string,
  updates: Array<{ extId: string; data: Partial<Extinguisher> }>,
): Promise<void> {
  // Implementation using writeBatch, chunked at 499
}
```

**Definition of done**: `updateExtinguisher` and `batchUpdateExtinguishers` exported from extinguisherService.

---

### P14-07: Add JSON backup export button

**File**: `src/components/extinguisher/ImportExportBar.tsx` (MODIFY)

Add an "Export Backup" button next to the existing "Export CSV" button. This exports ALL extinguisher data as a JSON file that can be re-imported via the existing JSON import flow.

Implementation:
1. Add an `onExportBackup` handler or implement inline
2. Use `getAllActiveExtinguishers(orgId)` from extinguisherService to get all data
3. Serialize to JSON with pretty-printing
4. Trigger browser download via `Blob` + `URL.createObjectURL` + hidden anchor click

```typescript
async function handleExportBackup() {
  if (!orgId) return;
  setExporting(true);  // reuse or add separate state
  setError('');
  try {
    const allExt = await getAllActiveExtinguishers(orgId);
    const backup = {
      exportedAt: new Date().toISOString(),
      orgId,
      version: '3.0',
      extinguishers: allExt,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ex3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Export failed.');
  } finally {
    setExporting(false);
  }
}
```

Add the button in the JSX after "Export CSV":
```jsx
<button onClick={handleExportBackup} disabled={exporting} className="...">
  <Download className="h-4 w-4" />
  Export Backup
</button>
```

Need to import `getAllActiveExtinguishers` from `extinguisherService.ts`. Check if it exists — yes, it's already imported in `Inventory.tsx`.

**Definition of done**: "Export Backup" button next to "Export CSV" downloads a JSON file containing all active extinguishers. The JSON format is compatible with the existing JSON import modal.

---

### P14-08: Build verification

Run all three build commands to verify no TypeScript errors or lint failures:

1. `pnpm build` — frontend build
2. `cd functions && npm run build` — Cloud Functions build
3. `pnpm lint` — ESLint

**Definition of done**: All three commands pass clean with 0 errors.

---

## Task Dependencies

```
P14-01 (button rename)     → independent, do first
P14-02 (mapper fix)        → independent, do early
P14-03 (backend fix)       → independent, do with P14-02
P14-04 (generate report)   → independent
P14-06 (update service)    → must complete before P14-05
P14-05 (data organizer)    → depends on P14-06
P14-07 (export backup)     → independent
P14-08 (build verify)      → do last, depends on all above
```

**Recommended build order**: P14-01 → P14-02 → P14-03 → P14-04 → P14-07 → P14-06 → P14-05 → P14-08

---

## Key Files Reference

| File | Role |
|------|------|
| `src/components/extinguisher/ImportExportBar.tsx` | Import/export buttons UI |
| `src/components/extinguisher/ColumnMapperModal.tsx` | Column mapping for import |
| `functions/src/data/importCSV.ts` | Backend CSV import Cloud Function |
| `src/pages/Reports.tsx` | Reports page |
| `src/services/reportService.ts` | Report service with `generateReportDownload` |
| `src/components/reports/ReportDownloadButton.tsx` | Existing download button component |
| `src/pages/DataOrganizer.tsx` | NEW — data organizer page |
| `src/services/extinguisherService.ts` | Extinguisher CRUD service |
| `src/services/locationService.ts` | Location service for dropdown data |
| `src/routes/index.tsx` | Route definitions |
| `src/components/layout/Sidebar.tsx` | Sidebar navigation |
