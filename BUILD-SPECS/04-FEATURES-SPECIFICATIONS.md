# 04 — Features Specification

This document defines the major product features of Extinguisher Tracker 3 (EX3), including workflows, requirements, acceptance criteria, and important behavioral rules.

The goal of this system is to provide a professional, multi-tenant fire extinguisher inspection and compliance platform for organizations such as hospitals, schools, warehouses, property managers, and safety teams.

The application must support:

- multi-tenant organization accounts
- role-based team collaboration
- extinguisher inventory management
- monthly inspections
- compliance reminders
- lifecycle tracking
- barcode / QR asset workflows
- offline-capable field work
- audit-ready reporting
- plan-based feature gating

## Feature Categories

- Authentication and Onboarding
- Organization and Team Management
- Extinguisher Inventory Management
- Monthly Workspace Management
- Inspection Workflow
- Barcode and QR Workflows
- Photo Management
- GPS Location Tracking
- Time Tracking
- Section Notes
- Data Import
- Data Export and Reporting
- Extinguisher Replacement
- Duplicate Detection and Cleanup
- Search and Filtering
- Billing, Plans, and Subscription Enforcement
- Offline Support
- Audit Trail
- Compliance Reminders and Notifications
- Compliance Lifecycle Tracking
- Compliance Dashboard
- Inspection Routes
- Tag / QR Label Printing
- Legal Inspection Attestation

## 1. Authentication and Onboarding

### 1.1 User Signup

The user creates an account using Firebase Authentication.

#### Supported Launch Method

- email and password

#### Optional Future-Ready Method

- Google sign-in

#### After Signup

- a `usr/{uid}` document is created
- if the user has no memberships, they are routed to organization creation or invite acceptance

#### Acceptance Criteria

- user can create an account with email and password
- duplicate email addresses are rejected
- password requirements follow Firebase Auth behavior
- user document is created on first authenticated session
- user is routed correctly based on membership state

### 1.2 User Login

The user signs in with valid credentials.

#### After Login

- the app loads the user profile
- resolves active organization
- loads org-scoped dashboard data
- updates lastLoginAt

#### Acceptance Criteria

- user can sign in with valid credentials
- invalid credentials show a clear error
- active org is loaded after login
- last login timestamp is updated
- if the user has multiple organizations, the current or default org is loaded

### 1.3 Organization Creation

A user with no organization memberships can create an organization.

Organization creation is a backend-controlled workflow.

#### Flow

1. user opens Create Organization
2. user enters org details
3. Cloud Function creates:
   - org document
   - owner membership
   - **Stripe** customer
   - active/default org fields on user profile
4. client routes owner into plan selection / **Stripe** checkout

#### Acceptance Criteria

- organization can be created only by authenticated users
- creating an org creates an owner membership automatically
- **Stripe** customer is created
- user becomes active in the new org
- user is routed to plan selection or checkout

### 1.4 Invite Acceptance

A user with an invite link can join an existing organization.

Invite acceptance must always be backend-controlled.

#### Acceptance Criteria

- invite link displays invite details when valid
- invited user can sign in or sign up
- invite can only be accepted by matching email
- expired/revoked invites show a clear error
- accepted invites create active membership
- user is redirected into the correct org after acceptance

## 2. Organization and Team Management

### 2.1 Member Management

Owners and admins can manage organization members.

#### Supported Actions

- invite member
- revoke pending invite
- remove member
- change role
- view member list

#### Acceptance Criteria

- member list shows current active members
- pending invites are visible
- owner/admin can invite by email
- owner/admin can assign roles allowed by business rules
- owner/admin can remove members except the owner restrictions
- removed users lose org access immediately
- membership actions are logged in audit logs

### 2.2 Organization Settings

Owners and admins can configure organization-level settings.

Initial settings include:

- organization name
- timezone
- sections
- checklist defaults
- future compliance-related settings

#### Acceptance Criteria

- settings save successfully
- section changes appear everywhere relevant
- timezone affects org-specific dates/reminders
- removing a section does not delete extinguisher records automatically
- updates are visible to all members

### 2.3 Organization Switching

Users may belong to multiple organizations.

The application must support switching active organization context safely.

#### Acceptance Criteria

- org switcher appears only when user belongs to multiple orgs
- switching org clears old org state and loads new org state
- active org persists for future sessions
- user cannot switch into orgs where membership is inactive or missing
- no data from another org remains visible after switch

## 3. Extinguisher Inventory Management

### 3.1 Add Extinguisher

Owners and admins can manually add new extinguisher records.

#### Required Fields

- asset ID

#### Optional Fields

- barcode
- serial number
- manufacturer
- vicinity
- parent location
- section
- location hierarchy reference
- category
- extinguisher type
- service class
- extinguisher size
- manufacture date / year
- install date
- GPS
- reference photo(s)
- lifecycle metadata if known

#### Acceptance Criteria

- asset ID uniqueness is validated within the org
- new extinguisher appears in inventory
- optional fields can be saved when available
- default category is applied if none is chosen
- manufacture/service fields support later lifecycle calculations
- creation is logged

### 3.2 Edit Extinguisher

Owners and admins can edit extinguisher records.

Inspectors may edit only limited workflow-safe fields if explicitly allowed by business rules.

#### Acceptance Criteria

- editable fields can be changed and saved
- asset ID uniqueness is revalidated if changed
- plan-restricted features are enforced
- edits are logged in audit logs
- compliance and lifecycle recalculation can be triggered when needed

### 3.3 Delete Extinguisher

Owners and admins can delete extinguishers through soft delete.

#### Deletion Stores

- `deletedAt`
- `deletedBy`
- `deletionReason`

#### Acceptance Criteria

- delete requires confirmation
- reason is collected
- deleted records no longer show in normal inventory lists
- deletion is audit logged
- deleted data remains recoverable for future admin restore workflows if implemented later

### 3.4 Extinguisher Detail View

Any authorized member can view full extinguisher detail.

Detail view may display:

- identity fields
- type / size / category
- location fields
- GPS
- photos
- compliance summary
- lifecycle dates
- replacement history
- inspection history
- tag information

#### Acceptance Criteria

- detail view shows all permitted fields
- photos are expandable
- GPS shows map link when available
- replacement history is visible
- inspection history is ordered newest first
- compliance due dates are visible

## 4. Monthly Workspace Management

### 4.1 Create Workspace

Owners and admins can create a new monthly workspace.

Workspace represents one monthly inspection cycle.

#### On Workspace Creation

- one inspection record is created or seeded for each active extinguisher
- carry-forward notes may be applied based on settings
- workspace stats start in pending state
- duplicate month-year workspaces are prevented in v1

#### Acceptance Criteria

- workspace can be created for a month/year
- correct label and month key are generated
- one active inspection state exists per extinguisher per workspace
- duplicate month workspaces are blocked or clearly warned
- creation is logged

### 4.2 Switch Workspace

Users can switch between workspaces.

#### Acceptance Criteria

- workspace switcher lists accessible workspaces
- switching reloads inspection data
- section timer or route context is paused/reset appropriately
- archived workspaces are visible as read-only

### 4.3 Archive Workspace

Owners and admins can archive a completed workspace.

Archival should:

- lock workspace
- generate report snapshot
- preserve results
- prevent further editing

#### Acceptance Criteria

- archival requires confirmation
- archived workspace becomes read-only
- report snapshot is created
- archived workspace remains viewable
- future editing is blocked
- archival is logged

### 4.4 Reset Workspace

Owners and admins can reset a workspace to pending if business rules allow.

This is a dangerous action and must be explicitly confirmed.

#### Acceptance Criteria

- reset requires strong confirmation
- current state is preserved via report snapshot or event history
- inspections return to pending state
- reset is logged
- archived workspaces cannot be reset unless explicitly reopened through trusted workflow

## 5. Inspection Workflow

### 5.1 Perform Inspection

Inspectors, admins, and owners can perform inspections within an active workspace.

#### Inspection Flow

1. user navigates to section, route, search result, or scanned extinguisher
2. user opens inspection view
3. user completes checklist
4. user optionally adds photo
5. user optionally captures GPS if plan allows
6. user optionally enters notes
7. user sets pass or fail
8. user confirms legal attestation if required
9. inspection record is saved
10. inspection event is appended
11. workspace stats update

#### Acceptance Criteria

- checklist items are visible and editable
- photo capture works when allowed by plan
- GPS works when allowed by plan
- notes can be added
- pass/fail saves correctly
- inspector identity is recorded automatically
- attestation is captured when required
- inspection timestamp is stored
- inspection status updates in UI immediately

### 5.2 Reset Inspection to Pending

A completed inspection may be reset to pending if permissions and workspace state allow.

#### Acceptance Criteria

- reset is permission-checked
- previous state is preserved in inspection events
- current inspection returns to pending
- event is logged as `reset_to_pending`

### 5.3 Quick Pass

Allows fast pass marking without opening full workflow.

#### Acceptance Criteria

- quick pass is available where allowed
- records timestamp and inspector
- creates inspection event
- supports plan/role restrictions if needed

### 5.4 Quick Fail

Allows fast fail marking with required reason/note.

#### Acceptance Criteria

- quick fail requires note/reason
- fail status is saved
- timestamp and inspector are stored
- event history is created

## 6. Barcode and QR Workflows

### 6.1 Manual Barcode / Asset Search

All plans, including **Basic**, must support manual entry search.

Search targets:

- barcode
- asset ID
- optionally QR value if manually entered

#### Acceptance Criteria

- user can type search term
- app searches relevant fields within current org only
- matching extinguisher opens correctly
- no-match message is clear

### 6.2 Camera Barcode Scanning

Camera barcode scanning is available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Not available on:

- **Basic**

#### Acceptance Criteria

- scanner opens with live preview
- successful scan resolves to extinguisher record
- no-match is handled cleanly
- scan respects current org only
- closing scanner is possible without action

### 6.3 QR Scanning

QR scanning is available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Not available on:

- **Basic**

#### Acceptance Criteria

- QR scan opens matching extinguisher or route target
- deep links still require auth and org membership
- cross-org access is not possible through QR codes

## 7. Photo Management

### 7.1 Asset Reference Photos

Each extinguisher may have reference photos.

#### Acceptance Criteria

- photos can be uploaded or captured
- thumbnails appear in detail view
- photos can be expanded
- photo limits are enforced
- upload progress is shown
- photo deletion is permission-checked

### 7.2 Inspection Photos

Each inspection may include a workflow photo.

#### Available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Not available on:

- **Basic**

#### Acceptance Criteria

- user can capture/upload inspection photo where plan allows
- photo is tied to inspection record
- inspection history can show photo reference

## 8. GPS Location Tracking

### 8.1 Asset GPS

Extinguishers may store a permanent location coordinate.

#### Available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Acceptance Criteria

- GPS can be captured from device
- coordinates and accuracy are saved
- map link is displayed when data exists
- capture shows loading state
- GPS can be recaptured

### 8.2 Inspection GPS

Inspection workflow may record GPS at time of inspection.

#### Available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Acceptance Criteria

- GPS can be captured during inspection
- coordinates store on inspection record
- inspection history can display GPS data

## 9. Time Tracking

### 9.1 Section Timers

Sections may have time tracking totals for inspection work.

Available on:

- **Basic** and above if enabled
- may be emphasized on **Pro**, **Elite**, and **Enterprise**

#### Behavior

- start
- pause
- stop
- one timer active at a time

#### Acceptance Criteria

- timer controls are visible where allowed
- time displays clearly
- local state survives refresh where possible
- totals persist to **Firestore**
- switching workspace pauses active timer

### 9.2 Time Summary

Section time summary can be viewed and exported.

#### Acceptance Criteria

- all sections show totals
- total time summary is visible
- export works if feature is enabled
- reset/clear action is permission-checked

## 10. Section Notes

### 10.1 Per-Section Notes

Each section can have notes.

#### Supported Forms

- global notes
- workspace-specific notes
- save-for-next-month notes

#### Acceptance Criteria

- notes are editable by allowed roles
- save-for-next-month behavior works
- notes show last editor and timestamp
- notes are visible to appropriate team members

## 11. Data Import

### 11.1 Excel / CSV Import

Owners and admins can import extinguisher inventory.

#### Supported Formats

- `.xlsx`
- `.xls`
- `.csv`

#### Import Behavior

- file parsed on client or trusted workflow
- common headers mapped automatically
- duplicate asset IDs merged or flagged based on business rule
- new records created with safe defaults
- plan limits and over-limit logic enforced

#### Acceptance Criteria

- supported files upload successfully
- headers map flexibly
- duplicate handling is clear
- import summary reports adds/updates/errors
- import is audit logged
- import respects plan and org boundaries

### 11.2 JSON Database Import

Owners/admins may import full JSON backup if supported.

This is a high-risk destructive workflow.

#### Acceptance Criteria

- valid JSON required
- strong confirmation required
- backup is created before replace/import if destructive mode exists
- import summary is shown
- import is audit logged

## 12. Data Export and Reporting

### 12.1 Export Inspection Data

Supported export formats:

- CSV
- Excel
- JSON

Exports may include:

- inspection status
- notes
- checklist data
- timestamps
- inspector
- compliance fields

#### Acceptance Criteria

- filters work correctly
- exported file downloads successfully
- exports are org-scoped only
- export actions can be logged

### 12.2 Export Time Data

Section time data can be exported when enabled.

#### Acceptance Criteria

- all visible sections included
- time values are human-readable
- export reflects current workspace or selected scope

### 12.3 Printable List / Report View

Users can open a print-friendly list of extinguishers or inspection results.

#### Acceptance Criteria

- print layout is readable
- sections are grouped clearly
- output reflects current org and filters

### 12.4 Full Backup Export

Owners/admins can export org data as JSON backup if enabled.

#### Acceptance Criteria

- valid JSON produced
- organization data remains scoped correctly
- file can support restore workflows if implemented
- export is audit logged

## 13. Extinguisher Replacement

### 13.1 Replace Extinguisher

The system must track extinguisher replacement while preserving history.

#### Replacement Flow

1. user opens extinguisher detail
2. chooses replace
3. enters replacement metadata
4. old/new relationship is stored
5. lifecycle state updates
6. old history remains traceable

#### Acceptance Criteria

- replacement is logged
- new serial must be valid if required
- historical identity is preserved
- GPS may be preserved if same mounting point
- photos/history are handled according to replacement rules
- lifecycle status updates correctly

## 14. Duplicate Detection and Cleanup

### 14.1 Duplicate Scanner

Owners/admins can scan inventory for duplicates.

#### Potential Duplicate Keys

- asset ID
- barcode
- serial
- configurable combinations if needed later

#### Acceptance Criteria

- duplicate groups are shown clearly
- system identifies keep vs review candidates
- nothing is merged automatically without review unless explicitly configured

### 14.2 Duplicate Merge

Duplicate records can be reviewed and merged.

#### Acceptance Criteria

- user can review before confirm
- safe merge rules are applied
- audit trail is preserved
- deleted/merged records are handled safely
- operation is logged

## 15. Search and Filtering

### 15.1 Section Filter

Users can filter by section.

#### Acceptance Criteria

- section stats update dynamically
- counts reflect visible records

### 15.2 Status Filter

Users can filter by:

- pending
- pass
- fail
- archived states where relevant
- lifecycle/compliance states where relevant

#### Acceptance Criteria

- filters combine correctly with search and section

### 15.3 Text Search

Users can search by:

- asset ID
- barcode
- serial
- vicinity
- location
- section
- other indexed fields as available

#### Acceptance Criteria

- partial search works where supported
- results are org-scoped
- search remains reasonably fast

### 15.4 Sort

Sorting may support:

- asset ID
- location
- compliance due date
- status
- created date

#### Acceptance Criteria

- sort is predictable
- natural sort behavior is used where appropriate

### 15.5 Quick Lists

Shortcut filtered views may include:

- all passed
- all failed
- all pending
- all overdue
- all spare
- all replaced
- all hydro due
- all annual due

#### Acceptance Criteria

- quick lists apply correct filters
- quick lists remain searchable and sortable

## 16. Billing, Plans, and Subscription

### 16.1 Subscription Management

Owner can:

- subscribe
- manage billing through **Stripe** portal
- see current subscription state
- see plan and included limit

#### Acceptance Criteria

- plan is visible in UI
- billing portal opens correctly
- status updates after **Stripe** sync

### 16.2 Plan Gating

#### Basic

Includes:

- manual barcode entry/search
- inventory management
- monthly inspections
- reminders / notifications
- compliance dashboard basics
- reports
- lifecycle visibility
- 50 extinguishers included
- +$10/month per additional 50 extinguishers
- best for small businesses that want to replace paper logs and reduce paperwork

Does not include:

- camera scanning
- QR scanning
- GPS
- photo inspection workflows
- advanced field workflows reserved for higher plans
- AI assistant

#### Pro

Includes:

- everything in **Basic**
- camera barcode scanning
- QR scanning
- GPS capture
- photo capture
- tag printing
- routes
- audit logs
- 250 extinguishers included
- +$10/month per additional 50 extinguishers
- AI assistant

#### Elite

Includes:

- everything in **Pro**, including the AI assistant
- advanced reporting
- higher scale
- 500 extinguishers included
- +$10/month per additional 50 extinguishers

#### Enterprise

Includes:

- unlimited extinguishers
- custom pricing
- contact-sales / admin-managed setup
- future custom onboarding/integration readiness
- AI assistant

#### Acceptance Criteria

- UI hides unavailable features
- backend blocks restricted features
- over-limit rules are enforced
- plan changes update access after sync

### 16.3 Billing Restriction States

When subscription is not healthy:

- `past_due` → read-only or grace behavior
- `canceled` → limited retention behavior
- `unpaid` → billing recovery required
- no subscription → owner routed to checkout

#### Acceptance Criteria

- restriction banners appear
- write restrictions apply
- access follows billing rules consistently

## 17. Offline Support

### 17.1 Firestore Offline Persistence

App should support offline-capable inspection behavior.

#### Acceptance Criteria

- previously loaded data remains viewable offline
- inspection actions queue safely when offline
- offline writes appear in UI immediately where supported
- data syncs when connectivity returns
- org boundaries are not mixed in offline cache

### 17.2 Backup / Recovery Safety Net

Optional local backup/recovery support may exist as a safety net.

#### Acceptance Criteria

- local backup does not bypass server truth
- restore operations require confirmation
- backup data is org-scoped

## 18. Audit Trail

### 18.1 Inspection Events

Every meaningful inspection action creates immutable event history.

#### Acceptance Criteria

- inspection saves create events
- events cannot be modified or deleted through normal app use
- performer identity is preserved
- event history spans all workspaces as applicable

### 18.2 Audit Logs

Administrative and major operational actions create audit log entries.

Examples:

- member changes
- extinguisher CRUD
- replacements
- workspace creation/archive/reset
- billing events
- imports/exports
- tag printing
- attestation events

#### Acceptance Criteria

- specified actions create logs
- logs are append-only
- logs are visible to authorized roles
- logs include who and when

## 19. Compliance Reminders and Notifications

### 19.1 Monthly Reminders

The system generates monthly inspection reminders.

#### Available on:

- **Basic**
- **Pro**
- **Elite**
- **Enterprise**

#### Acceptance Criteria

- reminders are generated on schedule
- duplicate reminders are prevented
- reminders appear in dashboard and notifications
- reminder links open relevant workflow

### 19.2 Compliance Alerts

The system generates alerts for:

- overdue monthly inspections
- overdue annual inspections
- overdue six-year maintenance
- overdue hydro tests
- over-limit org state where relevant

#### Acceptance Criteria

- compliance alerts appear in dashboard
- alerts can link to filtered lists
- alerts update when status changes

## 20. Compliance Lifecycle Tracking

The system tracks:

- monthly inspection cycle
- annual inspection cycle
- 6-year maintenance where applicable
- hydrostatic test schedule by extinguisher type

#### Acceptance Criteria

- due dates calculate automatically
- compliance status updates automatically
- overdue flags are visible
- lifecycle calculations are reflected in inventory and reports

## 21. Compliance Dashboard

Dashboard provides real-time operational and compliance visibility.

Example metrics:

- total extinguishers
- pending this month
- passed
- failed
- overdue monthly
- annual due
- hydro due
- six-year due

#### Acceptance Criteria

- dashboard loads key metrics quickly
- clicking metrics opens filtered results
- alerts are visually clear
- dashboard respects org and plan context

## 22. Inspection Routes

Route-based workflows help inspectors move through facilities efficiently.

#### Available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Acceptance Criteria

- admins can create/edit routes
- routes display extinguisher order
- inspectors can work through route progress
- completion percentage is visible

## 23. Tag / QR Label Printing

System supports tag generation and printing.

#### Available on:

- **Pro**
- **Elite**
- **Enterprise**

#### Acceptance Criteria

- tags can be generated from extinguisher data
- QR links resolve correctly
- batch printing works where enabled
- printing actions are logged

## 24. Legal Inspection Attestation

Inspection save may require legal confirmation.

Example text:

- I certify this inspection was performed according to **NFPA 10**.

#### Acceptance Criteria

- attestation can be required by org/workflow settings
- attestation stores inspector identity and timestamp
- attestation is preserved in inspection state/history
- attestation is not casually editable after save

## Final Feature Rule

Every feature in this document must be implemented in a way that respects:

- organization isolation
- role permissions
- billing state
- plan-based access
- audit integrity
- lifecycle/compliance accuracy
- mobile field usability
