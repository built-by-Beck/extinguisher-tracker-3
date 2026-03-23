# Plan -- extinguisher-tracker-3

**Current Phase**: 13 -- Duplicate Detection + Data Import
**Last Updated**: 2026-03-22
**Author**: built_by_Beck

---

## Current Objective

Add data quality tools: (1) find and merge duplicate extinguishers by asset ID, and (2) import extinguisher data from JSON backup files. Duplicate detection runs client-side against cached/subscribed data. Merge and delete use client-side Firestore batch writes (chunked to 499). JSON import parses uploaded files, validates against the EX3 Extinguisher interface, previews before writing, and batch-creates using client-side Firestore writes (no new Cloud Function needed — the existing `importExtinguishersCSV` pattern is CSV-only and server-side; JSON import is client-side for simplicity and offline compatibility).

---

## Project State Summary

- **Phases 1-9**: Complete (Foundation, Core Ops, Billing, Workspaces, Inspections, Reminders, Compliance, Lifecycle, Reports, Audit Logs, Offline Sync, Guest Access, Barcode Scanner, Unified Locations/Sections)
- **Phase 10v2**: Complete (BarcodeDetector API scanner replacement)
- **Checklist enhancement**: Complete (categorized sections, photo capture, GPS capture, inspection history)
- **Phase 11**: Complete (Legal pages, Calculator, Confirm Modals, Printable List)
- **Phase 12**: Complete (Section Timer + Section Notes for WorkspaceDetail)
- **Existing ImportExportBar** (`src/components/extinguisher/ImportExportBar.tsx`) handles CSV import/export via Cloud Functions. JSON import is a separate feature for backup restoration.
- **Inventory page** (`src/pages/Inventory.tsx`) already has: search, filters, scan-to-add, CSV import/export bar, delete confirmations
- **Extinguisher interface** (`src/services/extinguisherService.ts`) has 40+ fields including lifecycle, compliance, replacement tracking
- **No client-side `writeBatch`** exists yet — all batch writes so far are in Cloud Functions. This phase introduces client-side batch writes.
- **`subscribeToExtinguishers`** supports `{ noLimit: true }` option to load all extinguishers (needed for duplicate scan)

---

## Tasks for This Round (Phase 13)

### Phase 13 — Duplicate Detection + Data Import

This phase adds two data quality features: (1) a duplicate detector that scans all extinguishers for matching asset IDs and lets the user merge/delete duplicates with a smart preference picker, and (2) a JSON backup import modal that parses uploaded files, validates them, shows a preview, and batch-creates extinguishers.

---

### P13-01: Create duplicate detection service functions

**File**: `src/services/duplicateService.ts` (NEW)

Service layer for detecting duplicate extinguishers and performing batch merge/delete operations.

**Types:**

```typescript
/** A group of extinguishers that share the same asset ID */
export interface DuplicateGroup {
  assetId: string;
  /** The extinguisher to keep (preferred by smart selection rules) */
  keep: Extinguisher;
  /** The extinguishers to remove (will be soft-deleted after merging data into keep) */
  remove: Extinguisher[];
}
```

**Functions:**

```typescript
import { type Extinguisher } from './extinguisherService.ts';

/**
 * Scan a list of extinguishers for duplicate asset IDs.
 * Groups by normalized assetId (trimmed, case-insensitive).
 * Returns only groups with 2+ extinguishers.
 * Uses smart preference to pick the "keep" extinguisher.
 */
export function findDuplicates(extinguishers: Extinguisher[]): DuplicateGroup[]

/**
 * Smart preference: pick which extinguisher to keep.
 * Priority:
 * 1. Prefer one that has been inspected (lastMonthlyInspection !== null) over pending
 * 2. If both inspected, prefer the one with the more recent lastMonthlyInspection
 * 3. If neither inspected, prefer the one with the more recent createdAt
 * 4. Prefer 'standard' category over 'spare', 'replaced', 'retired', 'out_of_service'
 */
export function pickPreferred(a: Extinguisher, b: Extinguisher): Extinguisher

/**
 * Merge data from remove extinguishers into the keep extinguisher.
 * - Merges photos arrays (keep's photos first, then unique others by URL)
 * - Merges replacementHistory arrays (deduplicated by replacedExtId)
 * - Picks the most recent non-null values for: lastMonthlyInspection,
 *   lastAnnualInspection, lastSixYearMaintenance, lastHydroTest
 * Returns the merged data as a Partial<Extinguisher> to apply via updateDoc.
 */
export function mergeExtinguisherData(
  keep: Extinguisher,
  remove: Extinguisher[],
): Partial<Extinguisher>

/**
 * Execute batch merge and soft-delete for a list of duplicate groups.
 * For each group:
 *   1. Update the keep doc with merged data
 *   2. Soft-delete each remove doc (set deletedAt, deletedBy, deletionReason)
 * Uses client-side Firestore writeBatch, chunked to 499 operations per batch.
 * Returns count of merged groups and deleted docs.
 */
export async function batchMergeDuplicates(
  orgId: string,
  uid: string,
  groups: DuplicateGroup[],
): Promise<{ mergedGroups: number; deletedDocs: number }>
```

**Implementation details for `batchMergeDuplicates`:**

```typescript
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

// For each group: 1 update (keep) + N deletes (remove) = 1 + N operations
// Chunk across groups, tracking op count, commit at 499
let batch = writeBatch(db);
let opCount = 0;

for (const group of groups) {
  const merged = mergeExtinguisherData(group.keep, group.remove);
  const keepRef = doc(db, 'org', orgId, 'extinguishers', group.keep.id!);

  // Check if adding this group would exceed limit
  const opsNeeded = 1 + group.remove.length;
  if (opCount + opsNeeded > 499) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }

  batch.update(keepRef, { ...merged, updatedAt: serverTimestamp() });
  opCount++;

  for (const rm of group.remove) {
    const rmRef = doc(db, 'org', orgId, 'extinguishers', rm.id!);
    batch.update(rmRef, {
      deletedAt: serverTimestamp(),
      deletedBy: uid,
      deletionReason: `Merged duplicate — kept ${group.keep.assetId} (${group.keep.id})`,
      updatedAt: serverTimestamp(),
    });
    opCount++;
  }
}

if (opCount > 0) {
  await batch.commit();
}
```

**Key considerations:**
- `findDuplicates` is a pure function — works on the already-subscribed extinguisher list, no Firestore calls. Works offline with cached data.
- Normalize assetId: `assetId.trim().toLowerCase()` for grouping, but display the original.
- `pickPreferred` compares two extinguishers and returns the better one. `findDuplicates` iterates the group using `reduce` with `pickPreferred` to find the keep candidate.
- Soft-delete (not hard delete) for safety — keeps audit trail. Uses `batch.update` not `batch.delete`.
- Import `Extinguisher` type from `extinguisherService.ts`.

---

### P13-02: Create DuplicateScanModal component

**File**: `src/components/extinguisher/DuplicateScanModal.tsx` (NEW)

A modal that shows the results of a duplicate scan and lets the user review and confirm merge actions.

**Props:**

```typescript
interface DuplicateScanModalProps {
  open: boolean;
  groups: DuplicateGroup[];
  scanning: boolean;
  onMerge: () => void;
  onCancel: () => void;
  merging: boolean;
}
```

**UI layout (based on old app's duplicate modal, EX3 styling):**

1. **Header**: "Duplicate Cleanup" title + X close button
2. **Scanning state**: Show spinner + "Scanning for duplicates..." when `scanning === true`
3. **No duplicates**: Show "No duplicates found" message with check icon when `groups.length === 0 && !scanning`
4. **Results summary**: "Found {groups.length} Asset ID(s) with duplicates. Total duplicates: {sum of remove.length}"
5. **Scrollable list** (max-h-[60vh] overflow-y-auto):
   - For each `DuplicateGroup`:
     - Card with border, gray-50 background
     - Bold "Asset ID: {assetId}"
     - **Keep** row: green badge, shows id (truncated), category, compliance status, last inspection date
     - **Remove** rows: red badge per row, shows id (truncated), category, why it was not preferred
6. **Footer buttons**: Cancel (gray) + "Merge & Remove Duplicates" (indigo-600, disabled when `merging`)
7. **Loading state during merge**: Button shows spinner + "Merging..."

**Styling references:**
- Use `useId()` for modal title ID (aria-labelledby)
- Include focus trap (Tab key wrapping) — match `ConfirmModal` pattern from `src/components/ui/ConfirmModal.tsx`
- Backdrop: fixed inset-0, bg-black/50, z-50
- Modal panel: max-w-3xl, rounded-lg, shadow-xl

**Icons from lucide-react**: `X`, `Loader2`, `CheckCircle`, `AlertTriangle`, `Copy` (for duplicate icon)

---

### P13-03: Integrate duplicate detection into Inventory page

**File**: `src/pages/Inventory.tsx` (MODIFY)

Add a "Find Duplicates" button and wire up the duplicate scan modal.

**Changes:**

1. **Import** `DuplicateScanModal` component, `findDuplicates`, `batchMergeDuplicates`, `DuplicateGroup` type from `duplicateService.ts`

2. **State** (add to existing state block):
   ```typescript
   const [showDupModal, setShowDupModal] = useState(false);
   const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
   const [dupScanning, setDupScanning] = useState(false);
   const [dupMerging, setDupMerging] = useState(false);
   ```

3. **Scan handler** (useCallback):
   ```typescript
   const handleDuplicateScan = useCallback(() => {
     setDupScanning(true);
     setShowDupModal(true);
     // Use setTimeout to allow modal to render before blocking scan
     setTimeout(() => {
       const groups = findDuplicates(items);
       setDupGroups(groups);
       setDupScanning(false);
       if (groups.length === 0) {
         // Keep modal open to show "no duplicates found" message
       }
     }, 50);
   }, [items]);
   ```

4. **Merge handler** (useCallback):
   ```typescript
   const handleDuplicateMerge = useCallback(async () => {
     if (!orgId || !user || dupGroups.length === 0) return;
     setDupMerging(true);
     try {
       const result = await batchMergeDuplicates(orgId, user.uid, dupGroups);
       setShowDupModal(false);
       setDupGroups([]);
       // Success feedback — items will update via subscription
     } catch (err) {
       // Error handling
     } finally {
       setDupMerging(false);
     }
   }, [orgId, user, dupGroups]);
   ```

5. **Button placement**: Add "Find Duplicates" button in the header button row, next to "Print List", before "Add Extinguisher". Only visible when `canEdit` is true.
   ```tsx
   {canEdit && (
     <button
       onClick={handleDuplicateScan}
       className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
     >
       <Copy className="h-4 w-4" />
       Find Duplicates
     </button>
   )}
   ```

6. **Modal render** (at bottom of component, before DeleteConfirmModal):
   ```tsx
   <DuplicateScanModal
     open={showDupModal}
     groups={dupGroups}
     scanning={dupScanning}
     onMerge={handleDuplicateMerge}
     onCancel={() => { setShowDupModal(false); setDupGroups([]); }}
     merging={dupMerging}
   />
   ```

7. **Import `Copy` icon** from lucide-react (add to existing import)

**Key considerations:**
- The `items` state already contains all subscribed extinguishers (loaded via `subscribeToExtinguishers` with default limit of 100). For accurate duplicate detection on large inventories, the scan should use `{ noLimit: true }`. However, modifying the subscription would load ALL extinguishers permanently. **Better approach**: keep the normal subscription as-is, but for the duplicate scan, do a one-time fetch with `noLimit: true` inside `handleDuplicateScan`. This requires a new function or using the existing `subscribeToExtinguishers` with a temporary subscription.
- **Revised approach**: Add a `getAllExtinguishers` function to `extinguisherService.ts` that does a one-time `getDocs` with no limit. Use this in `handleDuplicateScan` instead of `items`.

**Additional change to `src/services/extinguisherService.ts`** (MODIFY):

Add this function:

```typescript
/**
 * One-time fetch of ALL active (non-deleted) extinguishers.
 * Used for duplicate detection and data quality scans.
 * WARNING: may be large for orgs with many extinguishers.
 */
export async function getAllActiveExtinguishers(orgId: string): Promise<Extinguisher[]> {
  const q = query(
    extinguishersRef(orgId),
    where('deletedAt', '==', null),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Extinguisher[];
}
```

Update `handleDuplicateScan` to use `getAllActiveExtinguishers(orgId)` instead of `items`:

```typescript
const handleDuplicateScan = useCallback(async () => {
  if (!orgId) return;
  setDupScanning(true);
  setShowDupModal(true);
  try {
    const allExt = await getAllActiveExtinguishers(orgId);
    const groups = findDuplicates(allExt);
    setDupGroups(groups);
  } finally {
    setDupScanning(false);
  }
}, [orgId]);
```

---

### P13-04: Create JSON import service functions

**File**: `src/services/jsonImportService.ts` (NEW)

Service layer for parsing, validating, and importing JSON backup files into the EX3 Extinguisher collection.

**Types:**

```typescript
/** Shape of a single extinguisher in a JSON backup file */
export interface BackupExtinguisher {
  assetId?: string;
  serial?: string;
  barcode?: string;
  manufacturer?: string;
  category?: string;
  extinguisherType?: string;
  serviceClass?: string;
  extinguisherSize?: string;
  section?: string;
  vicinity?: string;
  parentLocation?: string;
  manufactureYear?: number;
  expirationYear?: number;
  // Old app fields that need mapping
  status?: string;          // old app field — maps to complianceStatus
  checkedDate?: string;     // old app field — maps to lastMonthlyInspection
  inspectionHistory?: Array<Record<string, unknown>>;
  photos?: Array<Record<string, unknown>>;
  // Allow any other fields (we'll pick what we recognize)
  [key: string]: unknown;
}

/** Shape of the JSON backup file */
export interface BackupFile {
  collections?: {
    extinguishers?: BackupExtinguisher[];
    [key: string]: unknown;
  };
  // Also support flat array format
  extinguishers?: BackupExtinguisher[];
  // Metadata
  date?: string;
  exportedBy?: string;
  totalItems?: number;
}

/** Result of validating a backup file */
export interface ValidationResult {
  valid: boolean;
  extinguishers: BackupExtinguisher[];
  errors: string[];
  warnings: string[];
}

/** Result of the import operation */
export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}
```

**Functions:**

```typescript
/**
 * Parse and validate a JSON backup file.
 * Accepts two formats:
 * 1. { collections: { extinguishers: [...] } } (old app export format)
 * 2. { extinguishers: [...] } (flat format)
 * 3. [...] (raw array of extinguisher objects)
 *
 * Validates:
 * - File is valid JSON
 * - Contains an array of extinguisher-like objects
 * - Each item has at least an assetId or serial
 * - Reports warnings for items missing recommended fields
 */
export function parseAndValidateBackup(jsonText: string): ValidationResult

/**
 * Map a BackupExtinguisher to EX3's Extinguisher shape.
 * Handles field name differences between old app and EX3:
 * - status → (ignored, EX3 calculates complianceStatus)
 * - checkedDate → lastMonthlyInspection (as ISO string)
 * - photos array → maps to EX3 photo structure
 * - inspectionHistory → (stored as-is if present, for future reference)
 */
export function mapToExtinguisher(
  item: BackupExtinguisher,
  uid: string,
): Record<string, unknown>

/**
 * Import a validated list of extinguishers into Firestore.
 * - Checks asset limit before starting
 * - Skips items whose assetId already exists in the org
 * - Uses client-side writeBatch, chunked to 499 operations
 * - Sets createdBy to the importing user's UID
 */
export async function importExtinguishers(
  orgId: string,
  uid: string,
  items: BackupExtinguisher[],
  assetLimit: number | null,
): Promise<ImportResult>
```

**Implementation details for `importExtinguishers`:**

```typescript
import { writeBatch, doc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

// 1. Fetch existing assetIds to check for conflicts
const extRef = collection(db, 'org', orgId, 'extinguishers');
const existingSnap = await getDocs(query(extRef, where('deletedAt', '==', null)));
const existingAssetIds = new Set(
  existingSnap.docs.map((d) => (d.data().assetId as string).trim().toLowerCase())
);

// 2. Check asset limit
const currentCount = existingSnap.size;
if (assetLimit && currentCount + items.length > assetLimit) {
  // Return error or truncate to fit
}

// 3. Batch create, skipping duplicates
let batch = writeBatch(db);
let opCount = 0;
let created = 0;
const skipped: string[] = [];

for (const item of items) {
  const assetId = (item.assetId ?? '').trim().toLowerCase();
  if (existingAssetIds.has(assetId)) {
    skipped.push(`"${item.assetId}" already exists`);
    continue;
  }

  const docRef = doc(extRef); // auto-ID
  const data = mapToExtinguisher(item, uid);
  batch.set(docRef, data);
  existingAssetIds.add(assetId); // prevent duplicates within the import itself
  opCount++;
  created++;

  if (opCount >= 499) {
    await batch.commit();
    batch = writeBatch(db);
    opCount = 0;
  }
}

if (opCount > 0) {
  await batch.commit();
}
```

**Key considerations:**
- Import is client-side (not a Cloud Function) — works with cached Firestore data and supports offline queuing
- `mapToExtinguisher` must produce the exact same field set as `createExtinguisher` in `extinguisherService.ts` (40+ fields with defaults). Reference the `docData` object in `createExtinguisher` for the canonical field list.
- Handle both old app format (`{ collections: { extinguishers: [...] } }`) and flat format
- Normalize assetIds for duplicate checking but preserve original casing in the created doc
- Use `serverTimestamp()` for `createdAt` and `updatedAt`

---

### P13-05: Create DataImportModal component

**File**: `src/components/extinguisher/DataImportModal.tsx` (NEW)

A modal for uploading, previewing, and importing JSON backup files.

**Props:**

```typescript
interface DataImportModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  uid: string;
  assetLimit: number | null;
  currentCount: number;
}
```

**UI layout (3-step wizard):**

**Step 1 — Upload:**
- Dropzone area with dashed border (drag-and-drop + click to browse)
- Accept `.json` files only
- File input ref for programmatic click
- Show file name and size after selection
- "Next" button (disabled until file loaded and validated)

**Step 2 — Preview:**
- Validation result summary:
  - Green: "{N} extinguishers found in backup"
  - Amber warnings (e.g., "5 items missing serial number")
  - Red errors (e.g., "Invalid JSON format")
- Asset limit check: "Current: {currentCount}, Importing: {N}, Limit: {assetLimit}"
  - Red warning if would exceed limit
- Scrollable preview table (max 10 rows):
  - Columns: Asset ID, Serial, Type, Section, Category
  - Show "{total - 10} more..." text if truncated
- "Back" and "Import" buttons

**Step 3 — Result:**
- Success summary: "Created {N} extinguishers. {M} skipped."
- Error list if any
- "Done" button to close

**State:**

```typescript
const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
const [file, setFile] = useState<File | null>(null);
const [validation, setValidation] = useState<ValidationResult | null>(null);
const [importing, setImporting] = useState(false);
const [importResult, setImportResult] = useState<ImportResult | null>(null);
const [parseError, setParseError] = useState('');
```

**File handling:**

```typescript
const handleFileSelect = async (file: File) => {
  setFile(file);
  setParseError('');
  try {
    const text = await file.text();
    const result = parseAndValidateBackup(text);
    setValidation(result);
    if (result.valid) {
      setStep('preview');
    }
  } catch {
    setParseError('Failed to read file.');
  }
};
```

**Styling:**
- Match EX3 modal patterns (ConfirmModal for reference)
- Use `useId()` for modal title ID
- Focus trap (Tab key wrapping)
- Icons: `Upload`, `FileJson`, `CheckCircle`, `AlertTriangle`, `X`, `Loader2` from lucide-react

---

### P13-06: Integrate JSON import into Inventory page

**File**: `src/pages/Inventory.tsx` (MODIFY)

Add the "Import JSON" button and wire up the DataImportModal.

**Changes:**

1. **Import** `DataImportModal` component

2. **State**:
   ```typescript
   const [showImportModal, setShowImportModal] = useState(false);
   ```

3. **Button placement**: Add "Import JSON" button inside the existing `ImportExportBar` area OR as a separate button. Since `ImportExportBar` already handles CSV import/export, the cleanest approach is to add a JSON import button next to the CSV import in `ImportExportBar`.

**Better approach — modify ImportExportBar:**

**File**: `src/components/extinguisher/ImportExportBar.tsx` (MODIFY)

Add a new prop `onImportJSON` and render a second import button:

```typescript
interface ImportExportBarProps {
  onImportJSON?: () => void;
}

export function ImportExportBar({ onImportJSON }: ImportExportBarProps) {
  // ... existing code ...
  return (
    <div>
      {/* ... existing error/result messages ... */}
      <div className="flex items-center gap-3">
        {/* ... existing CSV Import button ... */}
        {/* ... existing CSV Export button ... */}

        {/* JSON Import */}
        {onImportJSON && (
          <button
            onClick={onImportJSON}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileJson className="h-4 w-4" />
            Import JSON Backup
          </button>
        )}
      </div>
    </div>
  );
}
```

Then in `Inventory.tsx`, pass the handler:

```tsx
<ImportExportBar onImportJSON={() => setShowImportModal(true)} />

{showImportModal && (
  <DataImportModal
    open={showImportModal}
    onClose={() => setShowImportModal(false)}
    orgId={orgId}
    uid={user?.uid ?? ''}
    assetLimit={org?.assetLimit ?? null}
    currentCount={totalCount}
  />
)}
```

**Import `FileJson`** from lucide-react in ImportExportBar.

---

### P13-07: Build verification

- Run `pnpm build` — fix any TypeScript errors
- Run `pnpm lint` — fix any ESLint warnings/errors
- Verify duplicate detection finds duplicates when two extinguishers share the same assetId
- Verify merge soft-deletes the non-preferred extinguisher and updates the kept one
- Verify JSON import parses old app backup format correctly
- Verify JSON import skips extinguishers whose assetId already exists
- Verify batch writes are chunked at 499

---

## Task Order

**Round 1 — Service layer (no UI dependencies):**
1. P13-01: Create `duplicateService.ts` — types, findDuplicates, pickPreferred, mergeExtinguisherData, batchMergeDuplicates
2. P13-04: Create `jsonImportService.ts` — types, parseAndValidateBackup, mapToExtinguisher, importExtinguishers
3. Add `getAllActiveExtinguishers` to `extinguisherService.ts`

**Round 2 — Components (depends on Round 1):**
4. P13-02: Create `DuplicateScanModal.tsx`
5. P13-05: Create `DataImportModal.tsx`

**Round 3 — Integration (depends on Round 2):**
6. P13-03: Integrate duplicate detection into Inventory page
7. P13-06: Integrate JSON import — modify ImportExportBar + Inventory page

**Round 4 — Verification:**
8. P13-07: Build verification

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P13-01 | None (uses existing Extinguisher type) |
| P13-04 | None (uses existing Extinguisher type) |
| getAllActiveExtinguishers | None |
| P13-02 | P13-01 (DuplicateGroup type) |
| P13-05 | P13-04 (ValidationResult, ImportResult types) |
| P13-03 | P13-01, P13-02, getAllActiveExtinguishers |
| P13-06 | P13-05 |
| P13-07 | All above |

---

## Blockers or Risks

1. **Large inventory performance**: `getAllActiveExtinguishers` loads all extinguishers at once. For an org with thousands of extinguishers, this could be slow. Acceptable for a manual "scan" action — not a subscription. The old app did the same thing (scanned `extinguishers` array in memory).

2. **Client-side writeBatch security**: The Firestore security rules for `extinguishers` already allow owners/admins to update and the soft-delete pattern uses `updateDoc`. The batch merge uses `batch.update` which goes through the same rules. No new security rules needed.

3. **Offline merge**: Client-side `writeBatch` will queue writes if offline. If the user merges duplicates while offline, the writes will sync when connectivity returns. This is correct behavior per EX3's offline-first design.

4. **JSON backup format compatibility**: The old app exported backups in `{ collections: { extinguishers: [...] } }` format. We also support flat `{ extinguishers: [...] }` and raw `[...]` arrays. The parser must be lenient with field names (old app used `status`, `checkedDate`, etc.) while mapping them to EX3 fields.

5. **Asset limit enforcement during import**: The import checks the limit before starting. If the org is near its limit, it should import up to the limit and report how many were skipped. This matches the existing `importExtinguishersCSV` Cloud Function behavior.

6. **No Cloud Function for JSON import**: Unlike CSV import (which uses a Cloud Function), JSON import is client-side. This is intentional — it avoids passing large payloads through Cloud Functions (which have a ~10MB request limit) and works offline. The trade-off is that security is enforced by Firestore rules (which already gate extinguisher creation to owners/admins) rather than by server-side validation.

---

## Key Code References

**Old app reference (duplicate detection + merge):**
- Duplicate state: `App.jsx` lines 369-373 (state variables)
- `pickPreferredDoc`: `App.jsx` lines 376-388 (smart preference logic — prefer checked over pending, newer over older)
- `computeDuplicateGroups`: `App.jsx` lines 390-409 (group by assetId, pick keep vs remove)
- `mergeHistories`: `App.jsx` lines 426-440 (merge inspection history arrays, deduplicate)
- `runDuplicateCleanup`: `App.jsx` lines 458-504 (batch merge + delete, set with merge)
- Duplicate modal UI: `App.jsx` lines 5390-5434

**Old app reference (JSON backup import):**
- `handleImportDatabaseBackup`: `App.jsx` lines 1229-1310 (parse JSON, confirm, delete old docs, create new)
- `exportDatabaseBackup`: `App.jsx` lines 1133-1160 (export format — `{ collections: { extinguishers: [...] } }`)

**EX3 files to modify:**
- `src/services/extinguisherService.ts` — add `getAllActiveExtinguishers`
- `src/pages/Inventory.tsx` — add duplicate scan button + modal, JSON import modal
- `src/components/extinguisher/ImportExportBar.tsx` — add JSON import button

**EX3 files to create:**
- `src/services/duplicateService.ts` — duplicate detection + merge logic
- `src/services/jsonImportService.ts` — JSON backup parse + import logic
- `src/components/extinguisher/DuplicateScanModal.tsx` — duplicate results modal
- `src/components/extinguisher/DataImportModal.tsx` — JSON import wizard modal

**EX3 files to reference (patterns):**
- `src/components/ui/ConfirmModal.tsx` — modal styling, focus trap, useId() pattern
- `src/services/extinguisherService.ts` — `createExtinguisher` docData (canonical field list for imports)
- `src/services/extinguisherService.ts` — `Extinguisher` interface (40+ fields)
- `functions/src/data/importCSV.ts` — batch write chunking pattern (499 limit), asset limit checking
- `src/components/extinguisher/ImportExportBar.tsx` — existing import/export UI
- `src/components/extinguisher/DeleteConfirmModal.tsx` — existing delete confirmation pattern

---

## Handoff to build-agent

**Start with P13-01** — create `src/services/duplicateService.ts`. Define the `DuplicateGroup` interface. Implement `pickPreferred` using the old app's logic adapted for EX3 fields: compare `lastMonthlyInspection` (not `checkedDate`), `createdAt`, and `category`. Implement `findDuplicates` that groups by normalized assetId and uses `reduce(pickPreferred)` to select the keep candidate. Implement `mergeExtinguisherData` that merges photos (deduplicate by URL) and picks latest non-null dates. Implement `batchMergeDuplicates` with chunked `writeBatch` at 499 ops.

**Also in Round 1** — add `getAllActiveExtinguishers` to `src/services/extinguisherService.ts`. Simple `getDocs` query with `where('deletedAt', '==', null)` and `orderBy('createdAt', 'desc')`, no limit.

**Then P13-04** — create `src/services/jsonImportService.ts`. Implement `parseAndValidateBackup` that accepts three JSON formats. Implement `mapToExtinguisher` that produces the same field set as `createExtinguisher`'s `docData` (reference lines 158-205 of `extinguisherService.ts`). Implement `importExtinguishers` with chunked `writeBatch`.

**Then P13-02** — create `src/components/extinguisher/DuplicateScanModal.tsx`. Use `useId()` for aria, focus trap from ConfirmModal. Display keep/remove with color badges.

**Then P13-05** — create `src/components/extinguisher/DataImportModal.tsx`. Three-step wizard: upload, preview, result. Drag-and-drop file input. Scrollable preview table.

**Then P13-03** — modify `Inventory.tsx`. Add state, handlers (useCallback), "Find Duplicates" button, and `DuplicateScanModal` render. Use `getAllActiveExtinguishers` for complete scan.

**Then P13-06** — modify `ImportExportBar.tsx` to accept `onImportJSON` prop. Modify `Inventory.tsx` to render `DataImportModal`.

**Finally P13-07** — run `pnpm build` and `pnpm lint` to verify everything compiles clean.

**Warnings from lessons-learned:**
- No `any` types. TypeScript strict mode.
- Always include `built_by_Beck` in commit messages.
- `useCallback` for all handlers passed as props or used in dependency arrays.
- `useId()` for element IDs referenced by aria attributes.
- Focus trap in all modals (Tab key wrapping).
- Chunk Firestore `writeBatch` to 499 operations.
- `set({ merge: true })` for upserts (per lessons-learned). For `batchMergeDuplicates`, use `batch.update` since we know the docs exist (they came from a query).
- When using `useEffect` with async data, reset state when dependencies change.
- For `useCallback` deps, use full objects (e.g., `user` not `user?.uid`) per React Compiler lesson.
- ESLint flat config: rule overrides in the config block that loads those plugins.

---

## Definition of Done

Phase 13 is complete when ALL of the following are true:

1. **`duplicateService.ts`** exists at `src/services/duplicateService.ts` with `DuplicateGroup` type, `findDuplicates`, `pickPreferred`, `mergeExtinguisherData`, `batchMergeDuplicates` functions
2. **`getAllActiveExtinguishers`** function added to `src/services/extinguisherService.ts`
3. **`jsonImportService.ts`** exists at `src/services/jsonImportService.ts` with `parseAndValidateBackup`, `mapToExtinguisher`, `importExtinguishers` functions
4. **`DuplicateScanModal.tsx`** exists at `src/components/extinguisher/DuplicateScanModal.tsx` with scan results display, merge confirmation
5. **`DataImportModal.tsx`** exists at `src/components/extinguisher/DataImportModal.tsx` with upload, preview, result steps
6. **Inventory page** has "Find Duplicates" button (owner/admin only) that opens DuplicateScanModal
7. **Inventory page** has "Import JSON Backup" button (via ImportExportBar) that opens DataImportModal
8. **Duplicate detection** correctly groups extinguishers by normalized assetId
9. **Smart preference** picks the inspected/newer extinguisher to keep
10. **Batch merge** updates keep doc with merged data and soft-deletes remove docs, chunked to 499 ops
11. **JSON import** parses old app backup format and flat format
12. **JSON import** validates items and skips existing assetIds
13. **JSON import** respects asset limit
14. **All modals** use `useId()` for aria and include focus traps
15. **`pnpm build` passes** with no TypeScript errors
16. **`pnpm lint` passes** with no new warnings

---

## Future Phases (Outline)

### Phase 14 — Export Options + Status Quick Lists

**Goal**: Enhance report exports with granular options; add quick-access filtered lists by status.

**Tasks (to be detailed when Phase 14 starts):**
- P14-01: Create `ExportOptionsModal` (checkboxes: include photos, GPS, checklist, history)
- P14-02: Integrate ExportOptionsModal into Reports page (before CSV/JSON generation)
- P14-03: Update report service to respect export options
- P14-04: Create `StatusQuickList` component (filtered extinguisher list by status)
- P14-05: Add clickable stat cards to Dashboard that open quick lists (passed/failed/pending/spares)
- P14-06: Add status quick list to WorkspaceDetail (section-scoped filtering)
- P14-07: Build verification

**Reference**: Old app's export modal, quick-access status modals

---

### Phase 15 — Workspace Switcher + Granular Share Settings

**Goal**: QoL workspace switching; enhance guest access with visibility toggles.

**Tasks (to be detailed when Phase 15 starts):**
- P15-01: Create `WorkspaceSwitcher` modal component (list active workspaces, quick-switch, create inline)
- P15-02: Integrate WorkspaceSwitcher into Topbar or Sidebar
- P15-03: Add keyboard shortcut for workspace switcher (Ctrl+K or similar)
- P15-04: Add `guestVisibilityToggles` to GuestAccessConfig type (hide notes, hide logs, hide custom assets)
- P15-05: Add toggle UI to guest access settings in OrgSettings
- P15-06: Enforce visibility toggles in GuestLayout / guest pages (conditionally hide sections)
- P15-07: Build verification

**Reference**: Old app's workspace switcher modal, share settings toggles

---

### Phase 16 — Admin Mode / Danger Zone

**Goal**: Power-user owner-only tools for data management.

**Tasks (to be detailed when Phase 16 starts):**
- P16-01: Add "Danger Zone" section to OrgSettings (owner-only, gated by role)
- P16-02: "Reset all workspace timers" function
- P16-03: "Export full org data as JSON" function (all collections)
- P16-04: "Delete all extinguishers" function (with double-confirm using ConfirmModal + type org name to confirm)
- P16-05: Build verification

**Reference**: Old app's admin mode, danger zone patterns. Use ConfirmModal from Phase 11.

---

### Phase 17 — Custom Asset Checker (Future Expansion)

**Goal**: Allow tracking non-extinguisher assets (exit signs, fire alarms, etc.) with dynamic columns.

**Tasks (to be detailed when Phase 17 starts):**
- P17-01: Design custom asset type schema (dynamic columns, custom checklist items)
- P17-02: Create Cloud Function for custom asset type CRUD
- P17-03: Create Custom Asset type management UI in Settings
- P17-04: Create Custom Asset table component with dynamic columns
- P17-05: Create Custom Asset inspection workflow
- P17-06: Add custom asset tabs to Dashboard/Inventory
- P17-07: Build verification

**Reference**: Old app's `CustomAssetChecker.jsx` (319 lines) and `CustomAssetTable.jsx` (493 lines)

---

### Future / Deferred

- **AdSense Integration** (Phase 18+): Add after launch when there's traffic. Simple component, marketing pages only.
- **Device Sync Modal**: Tracker-3's real-time Firestore sync mostly handles this. Evaluate need after field testing.

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

### Phase 9 -- Unify Locations & Sections (COMPLETE)
10 tasks. Unified locations/sections data model. Reviewed and approved.

### Phase 10 -- Replace Scanner with @zxing/browser (WRONG REFERENCE -- REDO)
5 tasks completed and reviewed, but used wrong reference scanner. Superseded by Phase 10v2.

### Phase 10v2 -- Replace Scanner with BarcodeDetector API (COMPLETE)
5 tasks. Correct reference scanner. Native BarcodeDetector + polyfill. Reviewed and approved.

### Checklist Enhancement (COMPLETE)
Categorized sections, photo capture, GPS capture, inspection history in checklist.

### Phase 11 -- Legal Pages, Calculator, Confirm Modals, Printable List (COMPLETE)
14 tasks. ConfirmModal, PromptModal, replaced window.confirm in 5 files, About/Terms/Privacy pages, native NFPA 10 Calculator, PrintableList. Reviewed and approved.

### Phase 12 -- Section Timer + Section Notes (COMPLETE)
11 tasks. useSectionTimer hook, SectionTimer + SectionNotes components, sectionNotesService, WorkspaceDetail integration, archiveWorkspace + createWorkspace backend changes, Firestore rules. Reviewed and approved (4 bugs fixed during review).
