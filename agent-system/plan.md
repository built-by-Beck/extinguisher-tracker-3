# Plan -- extinguisher-tracker-3

**Current Phase**: 10 -- Replace Barcode Scanner (html5-qrcode -> @zxing/browser)
**Last Updated**: 2026-03-20
**Author**: built_by_Beck

---

## Current Objective

Replace the broken barcode scanner implementation that uses `html5-qrcode` with the proven `@zxing/browser` + `BrowserMultiFormatReader` approach from the reference project (`/home/beck/projects/Fire_Extinguisher_Tracker/src/BarcodeScanner.jsx`).

The current scanner (`src/components/scanner/BarcodeScannerModal.tsx`) uses `html5-qrcode` which creates its own DOM elements and is not working correctly. The reference project uses a simple `<video>` element with `@zxing/browser`'s `decodeFromVideoDevice()` and is proven to work.

---

## Diagnosis

### Why the current scanner is broken

The `html5-qrcode` library:
1. Creates its own internal DOM elements inside `#barcode-scanner-region` — fragile, hard to control
2. Has complex state management (getState() returns numeric codes 2/3)
3. Requires a 100ms setTimeout hack to let DOM mount before starting
4. Stop/start lifecycle is error-prone (the `stopScanner` callback wraps everything in try/catch to swallow errors)
5. Torch support uses `any` casts and unreliable API

### Why the reference scanner works

The reference project (`BarcodeScanner.jsx`) uses `@zxing/browser`:
1. Uses a standard `<video>` element with a React ref — no DOM generation
2. `BrowserMultiFormatReader` + `decodeFromVideoDevice(null, videoRef.current, callback)` — simple API
3. Camera permission requested explicitly via `navigator.mediaDevices.getUserMedia`
4. Three clear states: loading (permission null), denied (permission false), scanning (permission true)
5. Cleanup via `reader.reset()` — straightforward

### What needs to change

1. **Dependency swap**: Remove `html5-qrcode`, add `@zxing/browser` + `@zxing/library`
2. **Rewrite `BarcodeScannerModal.tsx`**: Use `@zxing/browser` with `<video>` element approach
3. **Preserve interface**: Keep `ScanResult { text, format }`, `BarcodeScannerModalProps { open, onClose, onScan }`, manual entry mode
4. **No changes needed to consumers**: `ScanSearchBar.tsx`, `WorkspaceDetail.tsx`, `Dashboard.tsx`, `Inventory.tsx` all use the same interface

---

## Tasks for This Round

### P10-01: Swap npm dependencies

- Remove `html5-qrcode` from `package.json`
- Add `@zxing/browser` and `@zxing/library`
- Run `pnpm install`
- Verify no other files import from `html5-qrcode`

### P10-02: Rewrite BarcodeScannerModal.tsx with @zxing/browser

**File**: `src/components/scanner/BarcodeScannerModal.tsx`

**Must preserve (public API contract):**
```typescript
export interface ScanResult {
  text: string;
  format: string;
}

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
}

export default function BarcodeScannerModal({ open, onClose, onScan }: BarcodeScannerModalProps)
```

**Implementation approach (model on reference project):**

1. **State**: `error`, `manualMode`, `manualValue`, `hasPermission` (null = loading, true = granted, false = denied), `isScanning`
2. **Refs**: `videoRef` (HTMLVideoElement), `readerRef` (BrowserMultiFormatReader instance)
3. **Scanner lifecycle**:
   - `initializeScanner()`:
     - Request camera permission via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`
     - On success: set `hasPermission = true`, stop the test stream, create `new BrowserMultiFormatReader()`, call `startScanning(reader)`
     - On error: set `hasPermission = false`, set appropriate error message
   - `startScanning(reader)`:
     - `reader.decodeFromVideoDevice(null, videoRef.current, (result, error) => { ... })`
     - On result: extract `result.getText()` and `result.getBarcodeFormat()` (from `@zxing/library`), call `onScan({ text, format })`
     - On error with name !== 'NotFoundException': log (ignore NotFoundException, that's normal per-frame miss)
   - `stopScanner()`:
     - If `readerRef.current` exists, call `.reset()`
     - Set `isScanning = false`
4. **useEffect**: When `open` changes to true and not in manualMode, call `initializeScanner()`. On cleanup or when `open` becomes false, call `stopScanner()`.
5. **Important**: Use a `scannedRef` (boolean ref) to prevent multiple rapid-fire scan results. Once a scan is detected, set `scannedRef.current = true` and don't call `onScan` again. Reset it when the scanner starts.
6. **Remove**: All `html5-qrcode` imports, `SCANNER_REGION_ID`, `SUPPORTED_FORMATS`, `Html5Qrcode` usage, torch logic, camera switching logic (simplify — @zxing picks the best camera automatically via `null` device ID)

**UI structure (preserve existing Tailwind styling):**

- Keep the same modal container (fixed inset-0, bg-black/60, centered card)
- Keep the same header with title + close button
- **Camera mode**:
  - `hasPermission === null`: Show spinner + "Requesting camera permission..."
  - `hasPermission === false`: Show CameraOff icon + error message + "Try Again" button
  - `hasPermission === true`: Show `<video ref={videoRef} autoPlay playsInline muted>` with scanning overlay
- **Scanning overlay**: A red-bordered rectangle centered over the video (like the reference's `w-32 h-32 border-2 border-red-500 rounded-lg animate-pulse`). Adapt to the existing card style (use `border-red-500` to match EX3 branding).
- **Instruction text**: "Point your camera at a barcode or QR code"
- **Manual fallback button**: Keep the "Enter Manually" button below the video
- **Manual mode**: Keep exactly as-is (input + Search button + Camera button to go back)

### P10-03: Verify no other imports of html5-qrcode

- Search codebase for any remaining `html5-qrcode` imports
- If found, update them
- Should only be in `BarcodeScannerModal.tsx` (already handled by P10-02)

### P10-04: TypeScript build verification

- Run `pnpm build` — fix any TypeScript errors
- Run `cd functions && npm run build` — should be unaffected (backend doesn't use scanner)
- Verify the `ScanResult` export and `BarcodeScannerModal` default export work for `ScanSearchBar.tsx`

### P10-05: Verify consumer imports are unchanged

- `src/components/scanner/ScanSearchBar.tsx` — imports `BarcodeScannerModal` (default) and `ScanResult` (named type). Must still work.
- `src/pages/WorkspaceDetail.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Inventory.tsx` — use `ScanSearchBar`. No changes needed (they don't import the scanner directly).

---

## Task Order

**Round 1 — Dependency swap:**
1. P10-01: Remove html5-qrcode, add @zxing/browser + @zxing/library, pnpm install

**Round 2 — Rewrite scanner:**
2. P10-02: Rewrite BarcodeScannerModal.tsx with @zxing/browser

**Round 3 — Verification:**
3. P10-03: Verify no remaining html5-qrcode imports
4. P10-04: TypeScript build
5. P10-05: Verify consumer imports

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P10-01 | None |
| P10-02 | P10-01 (needs @zxing packages installed) |
| P10-03 | P10-02 |
| P10-04 | P10-01, P10-02 |
| P10-05 | P10-04 |

---

## Blockers or Risks

1. **@zxing/browser TypeScript types**: `@zxing/browser` and `@zxing/library` are TypeScript-native, so types should be available. The build-agent should verify the import paths. The main classes are `BrowserMultiFormatReader` from `@zxing/browser` and `BarcodeFormat` from `@zxing/library`.

2. **`result.getBarcodeFormat()` returns a BarcodeFormat enum, not a string**: The `ScanResult.format` field is a `string`. The build-agent should convert it via `BarcodeFormat[result.getBarcodeFormat()]` or `String(result.getBarcodeFormat())` to get a human-readable string (e.g., "QR_CODE", "CODE_128"). Check the @zxing API.

3. **Scanned ref to prevent double-fires**: The reference project calls `onScan(text)` then `stopScanner()` immediately, but the callback might fire again before `reset()` completes. Use a `scannedRef` boolean (like the current implementation does) to gate the `onScan` call.

4. **Video element must be in DOM before `decodeFromVideoDevice`**: The video ref must be rendered before calling the decode function. The reference handles this by only calling `startScanning` after permission is granted and the component renders the video element. The build-agent should ensure the video element renders when `hasPermission === true` and scanning starts after that render (use a second `useEffect` or call `startScanning` after setting `hasPermission`).

5. **Reader cleanup on unmount**: `BrowserMultiFormatReader.reset()` stops all media streams. Must be called on unmount AND when the modal closes. Use `useEffect` cleanup.

6. **No torch/flash support**: The @zxing/browser library doesn't have a built-in torch API. Remove torch controls. This is acceptable — torch was unreliable in the html5-qrcode implementation anyway.

7. **No camera switching UI**: The reference passes `null` as deviceId to `decodeFromVideoDevice`, which lets the browser pick the best camera (usually back camera due to the `facingMode: 'environment'` hint from the permission request). Remove the camera switch button. This simplifies the UI.

---

## Key Code References

**Reference working scanner** (adapt from this):
- `/home/beck/projects/Fire_Extinguisher_Tracker/src/BarcodeScanner.jsx`

**Files to modify:**
- `src/components/scanner/BarcodeScannerModal.tsx` — full rewrite
- `package.json` — dependency swap

**Files that must NOT change (verify only):**
- `src/components/scanner/ScanSearchBar.tsx` — imports `BarcodeScannerModal` default + `ScanResult` type
- `src/pages/WorkspaceDetail.tsx` — uses `ScanSearchBar`
- `src/pages/Dashboard.tsx` — uses `ScanSearchBar`
- `src/pages/Inventory.tsx` — uses `ScanSearchBar`

---

## Definition of Done

Phase 10 is complete when ALL of the following are true:

1. **`html5-qrcode` removed** from `package.json` and no imports remain in the codebase
2. **`@zxing/browser` and `@zxing/library` installed** in `package.json`
3. **`BarcodeScannerModal.tsx` rewritten** to use `BrowserMultiFormatReader` + `<video>` element
4. **Same public API preserved**: `ScanResult { text, format }` exported, `BarcodeScannerModalProps` unchanged, default export function signature unchanged
5. **Three permission states rendered**: loading spinner, denied error with retry, scanning with video + overlay
6. **Red target rectangle overlay** on the video during scanning
7. **Manual entry mode preserved** with same UI and behavior
8. **Scanner stops properly** on close, unmount, and successful scan
9. **`pnpm build` passes** with no TypeScript errors
10. **`ScanSearchBar.tsx` works unchanged** — no modifications needed to any consumer

---

## Handoff to build-agent

**Start with P10-01** — swap the dependencies. Remove `html5-qrcode`, add `@zxing/browser` and `@zxing/library`, run `pnpm install`.

**Then P10-02** — this is the main work. Rewrite `BarcodeScannerModal.tsx`. Model it on the reference scanner at `/home/beck/projects/Fire_Extinguisher_Tracker/src/BarcodeScanner.jsx` but:
- Keep TypeScript (not JSX)
- Keep the `ScanResult` interface and `BarcodeScannerModalProps` interface
- Keep the manual entry mode (the reference doesn't have one)
- Use the existing Tailwind card styling (rounded-xl, shadow-2xl, etc.)
- Add the red scanning overlay rectangle
- Add the `scannedRef` guard against double-fires
- Convert `BarcodeFormat` enum to string for `ScanResult.format`

**Then P10-03 through P10-05** — verification. Grep for `html5-qrcode`, run `pnpm build`, confirm consumers compile.

**Key patterns from the reference scanner to copy:**
1. Request permission first with `getUserMedia({ video: { facingMode: 'environment' } })`
2. Stop the test stream (`stream.getTracks().forEach(track => track.stop())`)
3. Create `new BrowserMultiFormatReader()`
4. Call `reader.decodeFromVideoDevice(null, videoRef.current, callback)`
5. In callback: `result.getText()` for the decoded text
6. Cleanup: `reader.reset()`

**Key difference from reference:**
- Reference calls `onScan(text)` with just a string. EX3 needs `onScan({ text, format })` with a `ScanResult` object. Extract format from `result.getBarcodeFormat()`.

**Warnings from lessons-learned:**
- No `any` types. TypeScript strict mode.
- Always include `built_by_Beck` in commit messages.
- When a useEffect fetches async data, reset state at the top of the effect.

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
