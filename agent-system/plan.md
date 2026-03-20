# Plan -- extinguisher-tracker-3

**Current Phase**: 10v2 -- Replace Barcode Scanner (@zxing/browser -> native BarcodeDetector API)
**Last Updated**: 2026-03-20
**Author**: built_by_Beck

---

## Current Objective

The Phase 10 build used the WRONG reference scanner. It adapted from `src/BarcodeScanner.jsx` (old ZXing version) instead of the ACTUAL working scanner at `src/components/BarcodeScanner.jsx` which uses the **native BarcodeDetector API** with `@undecaf/barcode-detector-polyfill` as fallback.

The current `@zxing/browser` scanner has real-world failures on mobile:
1. Shows front-facing camera instead of back camera
2. Camera switch gives "video source" errors
3. Double camera views appearing
4. Generally broken camera management

The reference scanner at `/home/beck/projects/Fire_Extinguisher_Tracker/src/components/BarcodeScanner.jsx` is proven to work. It uses a fundamentally different approach:
- **BarcodeDetector API** (native browser API, backed by Google ML Kit on Android/Chrome) with `@undecaf/barcode-detector-polyfill` fallback
- **Direct `getUserMedia` camera management** with smart constraint fallbacks (environment 1080p -> user 1080p -> any)
- **`setInterval(100ms)` polling** via `detector.detect(video)` instead of ZXing's callback-based `decodeFromVideoDevice`
- **Canvas overlay** for drawing detection boxes on detected barcodes
- **iOS Safari quirks** handled: playsinline, webkit-playsinline, video.play() retry, black-frame re-init
- **Camera switching** that actually works: stops current stream, requests opposite facingMode, restarts scanning

---

## Diagnosis

### Why @zxing/browser fails on mobile

`@zxing/browser`'s `decodeFromVideoDevice()` manages its own `getUserMedia` call internally. The developer passes `undefined` as deviceId and hopes ZXing picks the right camera. On mobile, this frequently:
- Selects the front camera instead of back
- Opens a second video stream when switching cameras
- Produces "video source" errors when trying to re-acquire the stream

The reference scanner avoids ALL of this by calling `getUserMedia` directly with explicit `facingMode` constraints, giving full control over stream lifecycle.

### Why the reference scanner works

1. **Direct stream management**: `navigator.mediaDevices.getUserMedia()` called directly with cascading constraint fallbacks
2. **BarcodeDetector API**: Native browser API (Chrome/Android) with polyfill fallback -- no heavy ZXing library needed
3. **Interval-based detection**: `detector.detect(video)` called every 100ms -- simple, reliable, no callback registration complexity
4. **Explicit stream cleanup**: `stream.getTracks().forEach(track => track.stop())` -- no relying on library internals
5. **iOS Safari handling**: playsinline attributes, video.play() retry, black-frame detection with auto re-init
6. **Working camera switch**: Stops old stream completely, requests new stream with opposite facingMode, re-attaches to video element

---

## Tasks for This Round

### P10v2-01: Swap npm dependencies

- Remove `@zxing/browser` and `@zxing/library` from `package.json`
- Add `@undecaf/barcode-detector-polyfill`
- Run `pnpm install`
- Verify no other files import from `@zxing/browser` or `@zxing/library`

### P10v2-02: Rewrite BarcodeScannerModal.tsx with BarcodeDetector API

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

**Implementation approach (model on reference scanner):**

1. **Imports**: `BarcodeDetectorPolyfill` from `@undecaf/barcode-detector-polyfill`. Also `lucide-react` icons: `X`, `Camera`, `CameraOff`, `Keyboard`.

2. **Type declarations**: The BarcodeDetector API is not in TypeScript's standard lib. Add a local type declaration at the top of the file (or a `.d.ts` file):
   ```typescript
   interface DetectedBarcode {
     rawValue: string;
     format: string;
     boundingBox?: DOMRectReadOnly;
     cornerPoints?: Array<{ x: number; y: number }>;
   }

   interface BarcodeDetectorInterface {
     detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
   }

   interface BarcodeDetectorConstructor {
     new (options?: { formats?: string[] }): BarcodeDetectorInterface;
     getSupportedFormats?(): Promise<string[]>;
   }
   ```
   Access native via `(window as any).BarcodeDetector` with fallback to `BarcodeDetectorPolyfill`.

3. **State**: `error: string | null`, `manualMode: boolean`, `manualValue: string`, `hasPermission: boolean | null` (null = loading, true = granted, false = denied), `isScanning: boolean`

4. **Refs**: `videoRef` (HTMLVideoElement), `streamRef` (MediaStream), `detectorRef` (BarcodeDetectorInterface), `scanIntervalRef` (ReturnType<typeof setInterval>), `scannedRef` (boolean -- double-fire guard), `canvasRef` (HTMLCanvasElement)

5. **Helper -- `getWorkingStream()`**: Cascading getUserMedia constraints (from reference):
   - Try 1: `{ facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }`
   - Try 2: `{ facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } }`
   - Try 3: `{ video: true }`
   This ensures we get a camera stream even on devices where environment mode is not available.

6. **`stopScanner()`**: (useCallback, no deps that change)
   - Clear `scanIntervalRef` interval
   - Stop all tracks on `streamRef.current`
   - Set `videoRef.current.srcObject = null`
   - Set `isScanning = false`

7. **`startContinuousScanning()`**:
   - Clear any existing interval
   - `scanIntervalRef.current = setInterval(async () => { ... }, 100)`
   - Inside interval: check `videoRef.current` exists, `readyState >= 2` (HAVE_CURRENT_DATA)
   - Call `detectorRef.current.detect(videoRef.current)`
   - If barcodes found and first has non-empty `rawValue`: set `scannedRef.current = true`, call `stopScanner()`, call `onScan({ text: barcode.rawValue.trim(), format: barcode.format })`
   - Optionally draw detection boxes on canvas overlay (nice-to-have from reference)

8. **`initializeScanner()`**: (async)
   - Reset state: `setError(null)`, `setHasPermission(null)`, `scannedRef.current = false`
   - Create BarcodeDetector: `const BarcodeDetector = (window as any).BarcodeDetector || BarcodeDetectorPolyfill`
   - Get supported formats, create detector instance with all supported formats (fallback to standard list)
   - Get camera stream via `getWorkingStream()`
   - Set `hasPermission = true`, store stream in `streamRef`
   - Attach stream to video element (with iOS Safari attributes: playsinline, webkit-playsinline)
   - Wait for `loadedmetadata` event, then `video.play()` with retry for iOS
   - Wait 500ms for iOS video dimensions to populate
   - Black-frame detection: if video dimensions are 0, auto re-init once (from reference)
   - Set `isScanning = true`, call `startContinuousScanning()`
   - Error handling: map error names to user-friendly messages (NotAllowedError, NotFoundError, NotSupportedError, NotReadableError, SecurityError)

9. **`switchCamera()`**: (from reference)
   - Read current facingMode from stream track settings
   - `stopScanner()`
   - Request new stream with opposite facingMode (environment <-> user)
   - If that fails, fall back to `getWorkingStream()`
   - Attach to video, play, start scanning
   - On error: set error message, call `initializeScanner()` to recover

10. **useEffect**: When `open` changes to true and not in manualMode:
    - Small delay (100ms setTimeout from reference) to ensure modal DOM is rendered
    - Call `initializeScanner()`
    - Cleanup: clear timeout, call `stopScanner()`
    - When `open` is false: `stopScanner()`

11. **UI structure (preserve existing EX3 Tailwind styling):**
    - Same modal container (fixed inset-0, bg-black/60, centered card, rounded-xl, shadow-2xl)
    - Same header with title + close button
    - **Camera mode**:
      - `hasPermission === null`: Spinner + "Requesting camera permission..."
      - `hasPermission === false`: CameraOff icon + error + "Try Again" button
      - `hasPermission === true`: `<video>` + `<canvas>` overlay + red scanning rectangle + instruction text + "Switch Camera" button + "Cancel" button
    - **Manual mode**: Keep exactly as current (input + Search + Camera toggle)
    - **Manual fallback button**: "Enter Manually" below the camera view

12. **Key difference from reference**:
    - Reference calls `onScan(text)` with just a string. EX3 needs `onScan({ text, format })` with a `ScanResult` object. The `DetectedBarcode.format` field is already a string (e.g., "qr_code", "code_128"), so pass it directly.
    - Reference uses JSX. EX3 uses TypeScript with strict types -- no `any` except for the `window.BarcodeDetector` check.
    - EX3 has manual entry mode (reference does not).
    - EX3 uses the existing card-style modal (reference uses full-screen).

### P10v2-03: Verify no remaining @zxing imports

- Search codebase for any remaining `@zxing/browser` or `@zxing/library` imports
- If found, update or remove them
- Should only be in `BarcodeScannerModal.tsx` (already handled by P10v2-02)

### P10v2-04: TypeScript build verification

- Run `pnpm build` -- fix any TypeScript errors
- The BarcodeDetector types may need attention -- ensure the type declarations compile cleanly
- Run `cd functions && npm run build` -- should be unaffected (backend doesn't use scanner)
- Verify the `ScanResult` export and `BarcodeScannerModal` default export work for `ScanSearchBar.tsx`

### P10v2-05: Verify consumer imports are unchanged

- `src/components/scanner/ScanSearchBar.tsx` -- imports `BarcodeScannerModal` (default) and `ScanResult` (named type). Must still work.
- `src/pages/WorkspaceDetail.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Inventory.tsx` -- use `ScanSearchBar`. No changes needed.

---

## Task Order

**Round 1 -- Dependency swap:**
1. P10v2-01: Remove @zxing/browser + @zxing/library, add @undecaf/barcode-detector-polyfill, pnpm install

**Round 2 -- Rewrite scanner:**
2. P10v2-02: Rewrite BarcodeScannerModal.tsx with BarcodeDetector API

**Round 3 -- Verification:**
3. P10v2-03: Verify no remaining @zxing imports
4. P10v2-04: TypeScript build
5. P10v2-05: Verify consumer imports

---

## Dependencies

| Task | Depends On |
|------|-----------|
| P10v2-01 | None |
| P10v2-02 | P10v2-01 (needs @undecaf/barcode-detector-polyfill installed) |
| P10v2-03 | P10v2-02 |
| P10v2-04 | P10v2-01, P10v2-02 |
| P10v2-05 | P10v2-04 |

---

## Blockers or Risks

1. **BarcodeDetector TypeScript types**: The BarcodeDetector API is not in TypeScript's standard lib (`lib.dom.d.ts`). Need local type declarations. The `@undecaf/barcode-detector-polyfill` package may or may not include types. Build-agent should check `node_modules/@undecaf/barcode-detector-polyfill` for `.d.ts` files. If none exist, declare types inline or in a `src/types/barcode-detector.d.ts` file.

2. **Polyfill import pattern**: The reference uses `import { BarcodeDetectorPolyfill } from '@undecaf/barcode-detector-polyfill'`. The build-agent should verify this import works in TypeScript and check if there are type exports from the package.

3. **Canvas overlay typing**: The `drawBarcodes` function uses `CanvasRenderingContext2D`. This is well-typed in TypeScript. The `DetectedBarcode` interface needs `boundingBox` and `cornerPoints` typed correctly.

4. **iOS Safari video element timing**: The reference handles this with multiple waits (500ms after play, 800ms retry, auto re-init). The build-agent should preserve this timing logic exactly -- do NOT simplify or remove the delays, they exist for real iOS quirks.

5. **`setInterval` inside component**: The scanning interval must be cleaned up in ALL exit paths: modal close, successful scan, component unmount, switching to manual mode. The `stopScanner` function handles this centrally.

6. **`scannedRef` guard**: Essential to prevent double-fire. The `setInterval(100ms)` could detect the same barcode multiple frames in a row before `stopScanner()` clears the interval. The ref gate prevents calling `onScan` more than once.

7. **Stream cleanup**: `streamRef.current.getTracks().forEach(track => track.stop())` must be called on every exit path. Failure to stop tracks leaves the camera LED on.

---

## Key Code References

**CORRECT reference scanner** (the one that actually works on mobile):
- `/home/beck/projects/Fire_Extinguisher_Tracker/src/components/BarcodeScanner.jsx`

**WRONG reference** (do NOT use -- this was the Phase 10 mistake):
- `/home/beck/projects/Fire_Extinguisher_Tracker/src/BarcodeScanner.jsx`

**Files to modify:**
- `src/components/scanner/BarcodeScannerModal.tsx` -- full rewrite
- `package.json` -- dependency swap

**Files that must NOT change (verify only):**
- `src/components/scanner/ScanSearchBar.tsx` -- imports `BarcodeScannerModal` default + `ScanResult` type
- `src/pages/WorkspaceDetail.tsx` -- uses `ScanSearchBar`
- `src/pages/Dashboard.tsx` -- uses `ScanSearchBar`
- `src/pages/Inventory.tsx` -- uses `ScanSearchBar`

---

## Handoff to build-agent

**Start with P10v2-01** -- swap the dependencies. Remove `@zxing/browser` and `@zxing/library`, add `@undecaf/barcode-detector-polyfill`, run `pnpm install`.

**Then P10v2-02** -- this is the main work. Rewrite `BarcodeScannerModal.tsx`. Model it closely on the reference scanner at `/home/beck/projects/Fire_Extinguisher_Tracker/src/components/BarcodeScanner.jsx` but:
- Keep TypeScript (not JSX) -- add type declarations for BarcodeDetector API
- Keep the `ScanResult` interface and `BarcodeScannerModalProps` interface
- Keep the manual entry mode (the reference doesn't have one)
- Use the existing EX3 Tailwind card styling (rounded-xl, shadow-2xl, etc.)
- Add the red scanning overlay rectangle (keep current red-500 branding, not green-400 from reference)
- Add the `scannedRef` guard against double-fires
- Add camera switching button (reference has it and it works)
- `DetectedBarcode.format` is already a string -- pass directly to `ScanResult.format`
- Copy the iOS Safari handling EXACTLY: playsinline attributes, video.play() retry, black-frame auto re-init
- Copy the cascading `getWorkingStream()` constraint fallbacks EXACTLY

**Then P10v2-03 through P10v2-05** -- verification. Grep for `@zxing`, run `pnpm build`, confirm consumers compile.

**Key patterns from the reference scanner to copy:**
1. `const BarcodeDetector = window.BarcodeDetector || BarcodeDetectorPolyfill`
2. `new BarcodeDetector({ formats: [...] })`
3. `getWorkingStream()` with cascading getUserMedia constraints
4. Attach stream to video element with iOS attributes
5. `setInterval(100ms)` calling `detector.detect(video)`
6. Check `video.readyState >= 2` before detecting
7. `barcode.rawValue` for the decoded text, `barcode.format` for the format string
8. `stream.getTracks().forEach(track => track.stop())` for cleanup
9. iOS black-frame detection and auto re-init
10. Camera switch via opposite facingMode

**Warnings from lessons-learned:**
- No `any` types (except the necessary `(window as any).BarcodeDetector` check). TypeScript strict mode.
- Always include `built_by_Beck` in commit messages.
- When a useEffect fetches async data, reset state at the top of the effect.
- Conditionally-rendered elements need a render flush before ref access (use setTimeout or useEffect).
- Refs avoid stale closure problems -- use refs for values read from closures.

---

## Definition of Done

Phase 10v2 is complete when ALL of the following are true:

1. **`@zxing/browser` and `@zxing/library` removed** from `package.json` and no imports remain
2. **`@undecaf/barcode-detector-polyfill` installed** in `package.json`
3. **`BarcodeScannerModal.tsx` rewritten** to use BarcodeDetector API + `<video>` + `<canvas>` overlay + `setInterval` polling
4. **Same public API preserved**: `ScanResult { text, format }` exported, `BarcodeScannerModalProps` unchanged, default export function signature unchanged
5. **Direct camera management**: `getUserMedia` called directly with cascading constraint fallbacks (not delegated to a library)
6. **Camera switching works**: Button to switch between front/back camera using opposite facingMode
7. **iOS Safari handling**: playsinline attributes, video.play() retry, black-frame auto re-init
8. **Three permission states rendered**: loading spinner (null), denied error with retry (false), scanning with video + overlay (true)
9. **Red scanning overlay** on the video during scanning
10. **Canvas overlay** for detection box drawing (optional but preferred)
11. **Manual entry mode preserved** with same UI and behavior
12. **Scanner stops properly** on close, unmount, successful scan, and mode switch -- camera LED turns off
13. **`scannedRef` guard** prevents double-fire from interval-based detection
14. **`pnpm build` passes** with no TypeScript errors
15. **`ScanSearchBar.tsx` works unchanged** -- no modifications needed to any consumer

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
5 tasks completed and reviewed, but used wrong reference scanner. @zxing/browser has mobile camera issues (front camera default, video source errors, double views). Superseded by Phase 10v2.
