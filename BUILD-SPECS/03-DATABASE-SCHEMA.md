03 — Database Schema

This document defines the Firestore database schema for Extinguisher Tracker 3 (EX3).

The system is organization-scoped.
All operational data belongs to an organization. No business data is stored under user documents.

The schema is designed to support:

strict multi-tenant isolation

role-based access control

organization-based billing

plan-based feature enforcement

monthly inspection workflows

annual inspection tracking

6-year maintenance tracking

hydrostatic testing tracking

immutable audit history

offline-capable field workflows

barcode and QR asset tracking

lifecycle calculations

exportable reports

legal inspection attestation

future scale for large organizations

Schema Conventions

The following conventions apply across the entire database.

All timestamps use Firestore Timestamp, not ISO strings.

All field names use camelCase.

All document IDs are auto-generated unless explicitly stated otherwise.

All string identifiers such as asset IDs, serial numbers, barcodes, QR values, and invite tokens are stored as strings.

Numeric values such as years, counters, sort orders, coordinates, limits, and durations use numeric types.

Soft deletion uses deletedAt: Timestamp | null unless otherwise specified.

Organization subcollections follow the pattern:

org/{orgId}/{collectionName}/{docId}

Arrays must not be used for unbounded growth. Any potentially unbounded list must be modeled as a subcollection.

Firestore does not provide native uniqueness constraints. Any uniqueness requirement must be enforced through backend logic, transactions, or deterministic document patterns.

Archived or immutable records must never be casually overwritten.

Compliance calculations should be driven by centralized logic, not random UI-only computations.

Data Modeling Principles

The schema is based on the following categories.

1. Identity and Access

Documents related to:

users

organizations

invites

memberships

roles

active organization context

2. Operational Reference Data

Long-lived records such as:

extinguisher inventory

locations

routes

organization settings

tag metadata

3. Mutable Workspace Data

Records that change during active workflows, such as:

monthly inspections

section notes

section time totals

in-app notifications

workspace stats

4. Immutable or Archived Historical Data

Append-only or snapshot data such as:

inspection events

audit logs

archived reports

legal attestation records where persisted separately

Top-Level Collections

The system uses three primary top-level collections:

org/{orgId}
usr/{uid}
invite/{inviteId}
org/{orgId} — Organizations

This is the tenant root document.

All operational data for an organization lives under this path.

Organization Shape
org/{orgId}
  name: string
  slug: string | null
  status: string                     // active, suspended, deleted
  ownerUid: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt: Timestamp | null

  // Plan + billing cache
  plan: string | null                // basic, pro, elite, enterprise
  assetLimit: number | null          // 50, 250, 500, null for unlimited
  overLimit: boolean | null

  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null  // active, trialing, past_due, canceled, unpaid
  subscriptionPriceId: string | null
  subscriptionCurrentPeriodEnd: Timestamp | null
  trialEnd: Timestamp | null

  // Optional cached feature flags
  featureFlags: {
    manualBarcodeEntry: boolean
    cameraBarcodeScan: boolean
    qrScanning: boolean
    gpsCapture: boolean
    photoUpload: boolean
    complianceReports: boolean
    inspectionReminders: boolean
    sectionTimeTracking: boolean
    tagPrinting: boolean
    bulkTagPrinting: boolean
    inspectionRoutes: boolean
  } | null

  // Organization settings
  settings: {
    timezone: string
    sections: string[]
    defaultChecklistItems: string[]
  }
Notes

ownerUid is the canonical owner reference.

status controls org lifecycle state.

plan, assetLimit, and overLimit support plan-aware workflows.

Stripe fields are cached billing state only. Stripe remains the billing source of truth.

slug is intended for friendly URLs, but uniqueness must be enforced by backend logic.

featureFlags may be derived from plan and cached for performance and UI convenience.

Suggested Indexes

slug

stripeCustomerId

status

plan

composite: status + plan

usr/{uid} — User Profiles

One document per Firebase Auth user.

Contains only user-level metadata.

User Shape
usr/{uid}
  displayName: string
  email: string
  photoURL: string | null
  defaultOrgId: string | null
  activeOrgId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt: Timestamp | null
Rules

A user may only read and write their own document.

The document ID must match request.auth.uid.

Notes

No organization business data is stored under usr/{uid}.

Membership is stored under org/{orgId}/members/{uid}.

activeOrgId controls current organization context in the UI.

defaultOrgId controls default org selection after login.

invite/{inviteId} — Pending Invitations

Stores organization invite records before membership is accepted.

Invite Shape
invite/{inviteId}
  orgId: string
  orgName: string
  email: string
  role: string
  invitedBy: string
  invitedByEmail: string
  status: string                     // pending, accepted, expired, revoked
  tokenHash: string
  createdAt: Timestamp
  expiresAt: Timestamp
  acceptedAt: Timestamp | null
  revokedAt: Timestamp | null
Suggested Indexes

tokenHash

composite: email + status

composite: orgId + status

Security Notes

Invite creation and acceptance must be handled by Cloud Functions.

Raw invite tokens must never be stored in Firestore.

Reads must be limited to:

authorized invite resolution flows

org admins/owners when appropriate

Organization Subcollections

All collections below are relative to:

org/{orgId}/...
members/{uid} — Organization Members

Stores org-specific membership and role information.

Member Shape
org/{orgId}/members/{uid}
  uid: string
  email: string
  displayName: string
  role: string                       // owner, admin, inspector, viewer
  status: string                     // active, invited, suspended, removed
  invitedBy: string | null
  joinedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
Rules

Document ID is the Firebase Auth UID.

Exactly one active member must hold role owner.

Role changes and ownership transfer must be backend-controlled.

Client code must not directly manage membership lifecycle.

Suggested Indexes

status

role

composite: status + role

locations/{locationId} — Physical Locations

Represents structured facility location data.

This supports campuses, buildings, floors, wings, zones, and rooms.

Location Shape
org/{orgId}/locations/{locationId}
  name: string
  parentLocationId: string | null
  locationType: string               // campus, building, floor, wing, zone, room, other
  section: string | null
  address: string | null
  gps: {
    lat: number
    lng: number
  } | null
  sortOrder: number
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  deletedAt: Timestamp | null
Notes

Supports hierarchical facility maps.

parentLocationId creates hierarchy.

section can remain as a simpler grouping field for legacy or quick filtering.

Suggested Indexes

section

parentLocationId

locationType

composite: parentLocationId + sortOrder

inspectionRoutes/{routeId} — Inspection Routes

Stores route-based inspection workflows.

Route Shape
org/{orgId}/inspectionRoutes/{routeId}
  name: string
  description: string | null
  locationId: string | null
  extinguisherIds: string[]          // bounded route membership list
  sortMode: string | null            // manual, location, custom
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
Notes

Routes are useful for large facilities.

Keep extinguisherIds bounded. If future route size becomes huge, route membership can move to a subcollection.

Suggested Indexes

active

locationId

extinguishers/{extId} — Extinguisher Inventory

This is the long-lived asset record for a physical extinguisher.

It stores identity, location, classification, compliance metadata, lifecycle metadata, and tagging metadata.

It does not store the mutable monthly inspection state for a workspace.

Extinguisher Shape
org/{orgId}/extinguishers/{extId}
  // Identity
  assetId: string
  barcode: string | null
  barcodeFormat: string | null       // code128, code39, etc.
  qrCodeValue: string | null
  qrCodeUrl: string | null
  serial: string

  // Physical description
  manufacturer: string | null
  category: string                   // standard, spare, replaced, retired, out_of_service
  extinguisherType: string | null    // ABC, BC, CO2, Water, WetChemical, Foam, CleanAgent, Halon, ClassD
  serviceClass: string | null        // storedPressure, cartridgeOperated, nonRechargeable, other
  extinguisherSize: string | null
  manufactureDate: Timestamp | null
  manufactureYear: number | null
  installDate: Timestamp | null
  inServiceDate: Timestamp | null
  expirationYear: number | null

  // Location
  vicinity: string
  parentLocation: string
  section: string
  locationId: string | null

  // Permanent asset GPS
  location: {
    lat: number
    lng: number
    accuracy: number
    altitude: number | null
    altitudeAccuracy: number | null
    capturedAt: Timestamp
    capturedBy: string
  } | null

  // Tagging
  tagPrintedAt: Timestamp | null
  tagPrintedBy: string | null
  tagVersion: number | null
  tagStatus: string | null           // active, reissued, damaged, missing

  // Reference photos (bounded)
  photos: [
    {
      url: string
      path: string
      uploadedAt: Timestamp
      uploadedBy: string
      type: string | null            // installation, reference, damage, maintenance
    }
  ]

  // Monthly / compliance lifecycle
  lastMonthlyInspection: Timestamp | null
  nextMonthlyInspection: Timestamp | null

  lastAnnualInspection: Timestamp | null
  nextAnnualInspection: Timestamp | null
  annualInspectorName: string | null
  annualInspectorCompany: string | null
  annualInspectionNotes: string | null

  lastSixYearMaintenance: Timestamp | null
  nextSixYearMaintenance: Timestamp | null
  sixYearTechnician: string | null
  sixYearCompany: string | null
  sixYearNotes: string | null
  requiresSixYearMaintenance: boolean | null

  lastHydroTest: Timestamp | null
  nextHydroTest: Timestamp | null
  hydroTestIntervalYears: number | null
  hydroTestTechnician: string | null
  hydroTestCompany: string | null
  hydroTestNotes: string | null

  // Lifecycle / compliance status
  lifecycleStatus: string | null     // active, spare, replaced, retired, removed, out_of_service
  complianceStatus: string | null    // compliant, monthly_due, annual_due, six_year_due, hydro_due, overdue, replaced, retired
  overdueFlags: string[]

  // Replacement tracking
  replacedByExtId: string | null
  replacesExtId: string | null
  replacementHistory: [
    {
      date: Timestamp
      oldAssetId: string
      oldSerial: string
      newAssetId: string
      newSerial: string
      reason: string
      performedBy: string
      performedByEmail: string
      notes: string
    }
  ]

  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  deletedAt: Timestamp | null
  deletedBy: string | null
  deletionReason: string | null
Notes

assetId, barcode, serial, qrCodeValue, and qrCodeUrl are strings.

manufactureYear, expirationYear, hydroTestIntervalYears are numeric.

photos must remain bounded. It is not a full media history store.

replacementHistory must remain bounded.

assetId uniqueness is required within an org and must be enforced by backend logic.

Barcode uniqueness should be enforced if business rules require one active barcode per active extinguisher.

Compliance and lifecycle fields support centralized lifecycle calculations.

Replacement and retirement state must not destroy historical traceability.

Suggested Indexes

assetId

barcode

serial

section

category

locationId

lifecycleStatus

complianceStatus

deletedAt

nextMonthlyInspection

nextAnnualInspection

nextSixYearMaintenance

nextHydroTest

composite: section + category

composite: section + deletedAt

composite: barcode + deletedAt

composite: assetId + deletedAt

composite: complianceStatus + deletedAt

composite: section + complianceStatus

workspaces/{workspaceId} — Monthly Inspection Cycles

A workspace represents one monthly inspection cycle for an organization.

For version 1, the document ID should be the monthYear string.

Example
workspaceId = "2026-03"
Workspace Shape
org/{orgId}/workspaces/{workspaceId}
  label: string                      // "Mar '26"
  monthYear: string                  // YYYY-MM
  status: string                     // active, archived, locked
  createdAt: Timestamp
  createdBy: string
  archivedAt: Timestamp | null
  archivedBy: string | null

  stats: {
    total: number
    passed: number
    failed: number
    pending: number
    lastUpdated: Timestamp
  }
Rules

At most one workspace per org per month in version 1.

Workspace archival is a privileged workflow.

Archived workspaces are read-only.

Locked/archive state must prevent casual record changes.

Suggested Indexes

status

monthYear

composite: status + monthYear

inspections/{inspectionId} — Workspace Inspection Records

Each inspection document represents the current inspection state of one extinguisher within one workspace.

This document is mutable while the workspace is active.

Inspection Shape
org/{orgId}/inspections/{inspectionId}
  extinguisherId: string
  workspaceId: string
  assetId: string
  section: string

  status: string                     // pending, pass, fail
  inspectedAt: Timestamp | null
  inspectedBy: string | null
  inspectedByEmail: string | null

  checklistData: {
    pinPresent: string
    tamperSealIntact: string
    gaugeCorrectPressure: string
    weightCorrect: string
    noDamage: string
    inDesignatedLocation: string
    clearlyVisible: string
    nearestUnder75ft: string
    topUnder5ft: string
    bottomOver4in: string
    mountedSecurely: string
    inspectionWithin30Days: string
    tagSignedDated: string
  } | null

  notes: string

  photoUrl: string | null
  photoPath: string | null

  gps: {
    lat: number
    lng: number
    accuracy: number
    altitude: number | null
    capturedAt: Timestamp
  } | null

  // Legal attestation
  attestation: {
    confirmed: boolean
    text: string | null
    inspectorName: string | null
    inspectorUserId: string | null
    deviceId: string | null
    confirmedAt: Timestamp | null
  } | null

  createdAt: Timestamp
  updatedAt: Timestamp
Notes

There must be only one inspection record per extinguisherId + workspaceId.

This is the current mutable state for the monthly inspection.

Historical changes are preserved in inspectionEvents.

Once the workspace is archived, inspection records become read-only.

Legal attestation may live inline here or in a dedicated sub-record model, but must be preserved.

Suggested Indexes

assetId

composite: workspaceId + status

composite: workspaceId + section

composite: workspaceId + section + status

composite: extinguisherId + workspaceId

composite: extinguisherId + inspectedAt

inspectionEvents/{eventId} — Immutable Inspection Event Log

Every meaningful inspection action creates an immutable event record.

This collection is append-only and is the authoritative audit trail for inspection activity.

Event Shape
org/{orgId}/inspectionEvents/{eventId}
  inspectionId: string
  extinguisherId: string
  workspaceId: string
  assetId: string

  action: string                     // inspected, reset_to_pending, status_changed, notes_updated, photo_added, attested
  previousStatus: string | null
  newStatus: string

  checklistData: map | null
  notes: string | null
  photoUrl: string | null
  gps: map | null
  attestation: map | null

  performedBy: string
  performedByEmail: string
  performedAt: Timestamp
Rules

append-only

no updates

no deletes

Suggested Indexes

composite: extinguisherId + performedAt

composite: workspaceId + performedAt

composite: performedBy + performedAt

sectionNotes/{noteId} — Per-Section Notes

Stores notes by section, optionally scoped to a workspace.

Note Shape
org/{orgId}/sectionNotes/{noteId}
  section: string
  workspaceId: string | null
  notes: string
  saveForNextMonth: boolean
  lastUpdatedBy: string
  lastUpdatedByEmail: string
  lastUpdated: Timestamp
  createdAt: Timestamp
Document ID Convention

global note: {section_slug}

workspace note: {workspaceId}_{section_slug}

sectionTimes/{timeId} — Section Time Totals

Stores accumulated section-level time totals for a workspace.

Time Shape
org/{orgId}/sectionTimes/{timeId}
  workspaceId: string
  section: string
  totalTimeMs: number
  lastUpdatedBy: string
  lastUpdated: Timestamp
Document ID Convention
{workspaceId}_{section_slug}
Notes

Running timer state is client-side only.

Firestore stores only accumulated totals.

notifications/{notificationId} — In-App Notifications

Stores organization-scoped notifications such as reminders and alerts.

Notification Shape
org/{orgId}/notifications/{notificationId}
  type: string                       // inspection_reminder, annual_due, hydro_due, over_limit, system
  title: string
  message: string
  dueMonth: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  sentAt: Timestamp | null
  createdAt: Timestamp
  readBy: string[] | null            // keep bounded; move later if needed
Notes

Notifications must be org-scoped.

Reminder generation must avoid duplicates.

If read-state grows too large, move to per-user notification-read tracking.

Suggested Indexes

type

createdAt

sentAt

reports/{reportId} — Archived Monthly Reports

Reports are generated during workspace archival and provide a read-only compliance snapshot.

Report Shape
org/{orgId}/reports/{reportId}
  workspaceId: string
  monthYear: string
  label: string
  archivedAt: Timestamp
  archivedBy: string

  totalExtinguishers: number
  passedCount: number
  failedCount: number
  pendingCount: number

  results: [
    {
      assetId: string
      section: string
      status: string
      inspectedAt: Timestamp | null
      inspectedBy: string | null
      notes: string
      checklistData: map | null
    }
  ]

  csvDownloadUrl: string | null
  excelDownloadUrl: string | null
  pdfDownloadUrl: string | null
  jsonDownloadUrl: string | null
Notes

Reports are created only by Cloud Functions or trusted backend workflows.

Reports are immutable after creation.

If result arrays become too large for Firestore size limits, detailed snapshots must move to Storage or subcollections.

Suggested Indexes

monthYear

workspaceId

auditLogs/{logId} — Organization Audit Log

Tracks administrative and major operational events.

This collection is append-only.

Audit Log Shape
org/{orgId}/auditLogs/{logId}
  action: string
  entityType: string
  entityId: string | null
  details: map
  performedBy: string
  performedByEmail: string
  performedAt: Timestamp
Example Action Types

member.invited

member.joined

member.removed

member.role_changed

member.suspended

extinguisher.created

extinguisher.updated

extinguisher.deleted

extinguisher.replaced

extinguisher.imported

workspace.created

workspace.archived

workspace.locked

settings.updated

billing.subscription_created

billing.subscription_canceled

billing.payment_failed

data.exported

data.imported

tag.generated

tag.printed

tag.reissued

inspection.attested

Suggested Indexes

performedAt descending

composite: entityType + entityId

composite: performedBy + performedAt

Firebase Storage Structure

The following storage path conventions must be used:

/org/{orgId}/assets/{extId}/{timestamp}_{filename}
/org/{orgId}/inspections/{inspectionId}/{timestamp}_{filename}
/org/{orgId}/reports/{reportId}/{filename}
/org/{orgId}/imports/{timestamp}_{filename}
/org/{orgId}/tags/{extId}/{timestamp}_{filename}
Storage Rules Summary
Read

any active member of the organization

Write

owner

admin

inspector where workflow allows

Delete

owner

admin

Max File Size

10 MB per file

Allowed MIME Types

image/jpeg

image/png

image/webp

text/csv

application/json

additional types such as PDF may be added if report generation requires them

Storage Metadata Recommendations

Uploaded files should include metadata when useful:

orgId

uploadedBy

entityType

entityId

workspaceId

assetId where relevant

Firestore Security Rules

The following rules are the baseline access model.

Exact validation rules may expand during implementation.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function memberDoc(orgId) {
      return /databases/$(database)/documents/org/$(orgId)/members/$(request.auth.uid);
    }

    function memberExists(orgId) {
      return isAuth() && exists(memberDoc(orgId));
    }

    function memberData(orgId) {
      return get(memberDoc(orgId)).data;
    }

    function isMember(orgId) {
      return memberExists(orgId) && memberData(orgId).status == 'active';
    }

    function hasRole(orgId, roles) {
      return isMember(orgId) && memberData(orgId).role in roles;
    }

    function orgDoc(orgId) {
      return /databases/$(database)/documents/org/$(orgId);
    }

    function hasWritableSubscription(orgId) {
      return get(orgDoc(orgId)).data.subscriptionStatus in ['active', 'trialing'];
    }

    match /usr/{uid} {
      allow read, create, update: if isAuth() && request.auth.uid == uid;
      allow delete: if false;
    }

    match /invite/{inviteId} {
      allow read: if isAuth() && (
        request.auth.token.email == resource.data.email ||
        hasRole(resource.data.orgId, ['owner', 'admin'])
      );
      allow write: if false;
    }

    match /org/{orgId} {
      allow read: if isMember(orgId);

      allow update: if hasRole(orgId, ['owner', 'admin'])
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
          'stripeCustomerId',
          'stripeSubscriptionId',
          'subscriptionStatus',
          'subscriptionPriceId',
          'subscriptionCurrentPeriodEnd',
          'trialEnd',
          'plan',
          'assetLimit',
          'overLimit',
          'ownerUid',
          'createdBy',
          'createdAt',
          'deletedAt'
        ]);

      allow create, delete: if false;

      match /members/{uid} {
        allow read: if isMember(orgId);
        allow write: if false;
      }

      match /locations/{locId} {
        allow read: if isMember(orgId);
        allow create, update: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
        allow delete: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
      }

      match /inspectionRoutes/{routeId} {
        allow read: if isMember(orgId);
        allow create, update: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
        allow delete: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
      }

      match /extinguishers/{extId} {
        allow read: if isMember(orgId);
        allow create: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
        allow update: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
        allow delete: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
      }

      match /workspaces/{wsId} {
        allow read: if isMember(orgId);
        allow create, update: if hasRole(orgId, ['owner', 'admin']) && hasWritableSubscription(orgId);
        allow delete: if false;
      }

      match /inspections/{inspId} {
        allow read: if isMember(orgId);
        allow create, update: if hasRole(orgId, ['owner', 'admin', 'inspector']) && hasWritableSubscription(orgId);
        allow delete: if false;
      }

      match /inspectionEvents/{eventId} {
        allow read: if isMember(orgId);
        allow create: if hasRole(orgId, ['owner', 'admin', 'inspector']) && hasWritableSubscription(orgId);
        allow update, delete: if false;
      }

      match /sectionNotes/{noteId} {
        allow read: if isMember(orgId);
        allow create, update: if hasRole(orgId, ['owner', 'admin', 'inspector']) && hasWritableSubscription(orgId);
        allow delete: if false;
      }

      match /sectionTimes/{timeId} {
        allow read: if isMember(orgId);
        allow create, update: if hasRole(orgId, ['owner', 'admin', 'inspector']) && hasWritableSubscription(orgId);
        allow delete: if false;
      }

      match /notifications/{notificationId} {
        allow read: if isMember(orgId);
        allow create, update: if false;
        allow delete: if false;
      }

      match /reports/{reportId} {
        allow read: if isMember(orgId);
        allow write: if false;
      }

      match /auditLogs/{logId} {
        allow read: if hasRole(orgId, ['owner', 'admin']);
        allow write: if false;
      }
    }
  }
}
Notes on Rules

These are baseline rules, not the final exhaustive validation layer.

Billing state remains backend-controlled.

Membership lifecycle remains backend-controlled.

Notifications are expected to be backend-generated.

Plan-aware UI logic must not replace rules or backend checks.

Additional field-level validation may be added later.

NFPA 13-Point Checklist Reference

Each monthly inspection uses the following 13 checklist items.

Each value must be one of:

pass

fail

n/a

Key	Description
pinPresent	Safety pin is present and intact
tamperSealIntact	Tamper seal is intact and unbroken
gaugeCorrectPressure	Pressure gauge reads in the correct zone
weightCorrect	Weight is within acceptable range
noDamage	No visible physical damage
inDesignatedLocation	Unit is in the designated location
clearlyVisible	Unit is clearly visible and unobstructed
nearestUnder75ft	Nearest extinguisher is within 75 feet travel distance
topUnder5ft	Top is no more than 5 feet from floor
bottomOver4in	Bottom is at least 4 inches from floor
mountedSecurely	Unit is securely mounted
inspectionWithin30Days	Last inspection date is within 30 days
tagSignedDated	Tag is signed and dated
Data Integrity Rules

The following integrity rules must be respected:

assetId must be unique within an organization

barcode values must be stored as strings

serial values must be stored as strings

QR values must be stored as strings

only one inspection record may exist per extinguisherId + workspaceId

inspectionEvents are append-only

auditLogs are append-only

reports are immutable after creation

member lifecycle changes are backend-controlled

billing fields on the org document are backend-controlled

archived workspaces must be read-only

soft-deleted records must be excluded from normal operational queries

cross-organization operational queries are forbidden

notifications and exports must remain org-scoped

replacement links must not create logical loops

lifecycle calculations must not run blindly on retired/deleted assets without context

Primary Query Patterns
Extinguisher Queries

all active extinguishers: where deletedAt == null

by section: where section == {section} and deletedAt == null

by barcode: where barcode == {barcode} and deletedAt == null

by assetId: where assetId == {assetId} and deletedAt == null

by category: where category == {category} and deletedAt == null

by compliance status: where complianceStatus == {status} and deletedAt == null

due monthly soon: where nextMonthlyInspection <= {date}

due annual soon: where nextAnnualInspection <= {date}

Inspection Queries

all for workspace: where workspaceId == {wsId}

by workspace and section: where workspaceId == {wsId} and section == {section}

by workspace and status: where workspaceId == {wsId} and status == {status}

by workspace, section, and status: where workspaceId == {wsId} and section == {section} and status == {status}

by extinguisher history: where extinguisherId == {extId} orderBy inspectedAt desc

Inspection Event Queries

asset history: where extinguisherId == {extId} orderBy performedAt desc

workspace activity: where workspaceId == {wsId} orderBy performedAt desc

user activity: where performedBy == {uid} orderBy performedAt desc

Workspace Queries

active workspaces: where status == 'active' orderBy createdAt desc

all workspaces: orderBy monthYear desc

Notification Queries

recent notifications: orderBy createdAt desc

type-based alerts: where type == {type}

Member Queries

active members: where status == 'active'

all members: no filter

Audit Log Queries

recent activity: orderBy performedAt desc limit 50

entity history: where entityType == {type} and entityId == {id} orderBy performedAt desc

Implementation Notes

client code must never directly manage billing fields

client code must never directly manage membership roles

invite resolution and acceptance must be backend-controlled

workspace archival should create a report snapshot and lock future edits

report or export files that exceed Firestore size limits must move to Firebase Storage

lifecycle calculations should be centralized

reminder generation should be centralized

plan enforcement must not live only in the UI

route, location, and notification models must remain organization-scoped

legal attestation data must remain preserved and audit-traceable
