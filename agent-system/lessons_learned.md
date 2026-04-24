## Lessons Learned

## 2026-04-24 - Replacement Must Preserve Asset Slot

Error: Initial implementation still allowed `assetId` edits in the replacement modal and wrote the submitted asset ID during replacement.

Impact: This violated the domain invariant that asset number is the permanent location/slot while serial/barcode identify the physical extinguisher.

Fix: The UI now displays asset ID as read-only, the callable treats the existing document `assetId` as canonical, and backend replacement rejects attempts to change asset ID during replacement.

Prevention: For replacement workflows, never treat asset/location identifiers as physical-unit fields. Only serial, barcode, manufacture/expiration/type/size/notes/photos should change.

## 2026-04-24 - Legacy Active Predicates Need Category/Status Guards

Error: Initial active-record fallback treated missing `lifecycleStatus` as active without checking legacy `category`, `status`, or `isActive` fields.

Impact: A legacy replaced or retired row could still be eligible for normal scan/search fallback and expose old serial/barcode values.

Fix: Active predicates now reject `category` values `replaced`, `retired`, and `out_of_service`, reject non-active `status`, and reject `isActive === false`.

Prevention: Any client/server active inventory predicate must account for both canonical lifecycle fields and legacy denormalized fields.
