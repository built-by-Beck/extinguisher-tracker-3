# 10 — Multi-Tenant Isolation

This document defines reporting, export formats, compliance snapshots,
and report access rules for **Extinguisher Tracker 3 (EX3)**.

Reports are a major product feature because this platform is a
**compliance management system**. Organizations rely on these reports to
demonstrate regulatory compliance and inspection completion.

Reference source: turn2file0

---

## Core Principles

Reports must follow strict rules:

- Reports are **always organization-scoped**
- Reports must never include data from another organization
- Archived monthly reports must be **immutable snapshots**
- Exports must reflect **current authorization and org context**
- Large report artifacts may be stored in **Firebase Storage**
- Reports must remain **legally defensible compliance records**

---

## Report Types

### Monthly Compliance Report

Purpose:

- snapshot of one workspace's final inspection state
- compliance documentation for auditors

Filters:

- `orgId`
- `workspaceId`

Includes:

- workspace label
- month/year
- total extinguishers
- passed count
- failed count
- pending count
- per-extinguisher results

---

### Failed Inspection Report

Purpose:

Identify extinguishers that require corrective action.

Filters:

- `orgId`
- `workspaceId` or date range
- optional section

Includes:

- `assetId`
- section
- failure status
- failure notes
- `inspectedAt`
- `inspectedBy`

---

### Section Progress Report

Purpose:

Track inspection progress across large facilities.

Filters:

- `orgId`
- `workspaceId`
- section

Includes:

- section name
- total assets
- passed
- failed
- pending
- section notes

---

### Asset History Report

Purpose:

Track full lifecycle history for a single extinguisher.

Includes:

- `assetId`
- barcode
- serial
- location
- replacement history
- inspection event timeline
- lifecycle compliance events

---

### Inventory Export

Purpose:

Export active extinguisher inventory.

Includes:

- `assetId`
- barcode
- serial
- section
- vicinity
- `parentLocation`
- `extinguisherType`
- size
- `manufactureYear`
- `expirationYear`

---

## Report Snapshot Rules

When a workspace is archived:

- A report snapshot is automatically generated
- Snapshot is immutable
- Workspace becomes read-only
- Report must preserve inspection results exactly as they existed during archive

Snapshots must **never change retroactively**.

---

## Firestore Report Storage

Report metadata stored in:

```
org/{orgId}/reports/{reportId}
```

Example:

```
workspaceId  monthYear  archivedAt  archivedBy  totalExtinguishers
passedCount  failedCount  pendingCount
```

Download URLs:

```
csvDownloadUrl  excelDownloadUrl  jsonDownloadUrl  pdfDownloadUrl
```

Large datasets may store detailed results in **Firebase Storage artifacts**.

---

## Supported Export Formats

Supported formats:

- CSV
- Excel
- JSON
- PDF

### CSV

Best for spreadsheet analysis.

### Excel

Best for formatted business reports.

### JSON

Best for backups and integrations.

### PDF

Best for **compliance documentation and management reporting**.

---

## Export Scope Rules

Exports must always be scoped to **one organization**.

Allowed:

- single organization inventory
- single workspace inspection data
- single asset history

Forbidden:

- cross-org exports
- exporting data without membership verification
- exporting data using client-side filtering after broad queries

---

## Minimum Export Fields

Inventory export must include:

- `assetId`
- `barcode`
- `serial`
- `section`
- `vicinity`
- `parentLocation`
- `category`
- `extinguisherType`
- `extinguisherSize`
- `manufactureYear`
- `expirationYear`

Inspection export must include:

- `workspaceId`
- `assetId`
- `section`
- `status`
- `inspectedAt`
- `inspectedBy`
- `notes`
- `checklistData`

---

## Report Generation Logic

### Automatic Reports

Generated when:

- workspace archived

Behavior:

- calculate inspection totals
- snapshot results
- store metadata in Firestore
- generate optional artifact

### On-Demand Reports

Triggered by user export actions.

System must:

- verify membership
- verify plan permissions
- verify org scope
- optionally log audit event

---

## Plan Rules

Reports and exports follow rules from the pricing model.

All paid plans support:

- compliance reports
- CSV export
- Excel export
- JSON export
- PDF reports

Enterprise plans may include:

- advanced analytics
- custom reporting
- API integrations

---

## Audit Logging

Report generation should write audit logs.

Example:

- `report.generated`
- `report.downloaded`
- `data.exported`

Example payload:

```json
{ "format": "csv", "entity": "inspections", "workspaceId": "2026-03" }
```

---

## Storage Paths

Suggested paths:

```
/org/{orgId}/reports/{reportId}/{filename}
/org/{orgId}/exports/{timestamp}_{type}.{ext}
```

Access rules:

- only org members may read
- only authorized users or backend may write
- cross-org access must be blocked

---

## Final Requirement

Every report must be:

- organization scoped
- permission checked
- plan aware
- immutable where required
- suitable for regulatory compliance
