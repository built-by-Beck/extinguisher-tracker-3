# 06 — Business Logic

This document defines the core algorithms, validation rules, feature
gating logic, compliance calculations, lifecycle workflows, and
operational rules that govern **Extinguisher Tracker 3 (EX3)**.

The business logic must support:

- organization-scoped multi-tenant behavior
- role-based access
- plan-based feature gating
- monthly inspection workflows
- compliance reminders
- lifecycle due-date calculation
- NFPA-aligned service intervals
- offline-safe field workflows
- audit logging
- legal inspection attestation
- archived record immutability

---

## Core Business Logic Principles

### Organization Scope

All operational logic must run inside a single active **organization context**.

No workflow may:

- read another organization's operational data
- write into another organization's data
- merge results across organizations
- export data from more than one organization at a time

### Role-Aware Actions

Business logic must always consider:

- authenticated user identity
- membership status
- organization-specific role
- plan
- billing state
- workspace state

### Plan-Aware Actions

Feature availability must not be determined by UI alone.

Business logic must enforce:

- plan-based feature access
- included extinguisher limits
- over-limit restrictions
- scanning permissions
- GPS/photo permissions
- routes access
- tag-printing access
- reminder availability

---

## Inspection Status Model

Every extinguisher has an **inspection status** within a workspace.

### Valid Status Values

- `pending` — not yet inspected in this workspace
- `pass` — inspected and passed
- `fail` — inspected and found deficient

### Allowed Status Transitions

- `pending` → `pass`
- `pending` → `fail`
- `pass` → `pending`
- `fail` → `pending`
- `pass` → `fail`
- `fail` → `pass`

Every status transition must generate an `inspectionEvent`.

---

## NFPA 13-Point Checklist

Each inspection includes a 13‑point compliance checklist.

Each item accepts:

- `pass`
- `fail`
- `n/a`

### Checklist Items

1. `pinPresent`
2. `tamperSealIntact`
3. `gaugeCorrectPressure`
4. `weightCorrect`
5. `noDamage`
6. `inDesignatedLocation`
7. `clearlyVisible`
8. `nearestUnder75ft`
9. `topUnder5ft`
10. `bottomOver4in`
11. `mountedSecurely`
12. `inspectionWithin30Days`
13. `tagSignedDated`

### Important Rule

The overall inspection result is chosen by the inspector and **not automatically derived** from checklist values.

---

## Inspection Save Logic

When an inspection is saved:

### Validation

1. Workspace must exist.
2. Workspace must be active.
3. User must belong to the organization.
4. User role must be `owner`, `admin`, or `inspector`.
5. Organization subscription must allow writes.
6. Plan restrictions must be enforced.

### Inspection Update

Update `inspections/{inspectionId}` with:

- `status`
- `inspectedAt`
- `inspectedBy`
- `inspectedByEmail`
- `checklistData`
- `notes`
- `photoUrl`
- `photoPath`
- `gps`
- `updatedAt`

### Inspection Event

Create `inspectionEvents/{eventId}` with:

- `action = inspected`
- `previousStatus`
- `newStatus`
- `checklistData`
- `notes`
- `photoUrl`
- `gps`
- `performedBy`
- `performedByEmail`
- `performedAt`

### Workspace Stats Update

Adjust:

- decrement previous status
- increment new status
- update `lastUpdated`
