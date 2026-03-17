# 07 --- API and Cloud Functions Specification

This document defines the backend operations and Firebase Cloud
Functions required for **Extinguisher Tracker 3 (EX3)**.

The system does not use a traditional backend API server. Instead, all
privileged operations are handled by **Firebase Cloud Functions** and
callable HTTPS endpoints.

Client applications interact directly with Firestore for standard
reads/writes that are permitted by Security Rules, while **all
privileged or security-sensitive operations must pass through Cloud
Functions**.

This design ensures:

-   multi-tenant data isolation
-   strict role enforcement
-   secure billing synchronization
-   auditable privileged actions
-   scalable serverless infrastructure

Reference source: fileciteturn1file0

------------------------------------------------------------------------

# Architecture Model

## Backend Strategy

Backend logic is implemented using:

-   Firebase **Callable Functions**
-   Firebase **HTTPS Functions**
-   Firebase **Scheduled Functions**
-   Firebase **Event-triggered Functions**
-   Stripe **Webhook Handlers**

There is **no persistent backend server**.

Cloud Functions perform:

-   validation
-   membership checks
-   role checks
-   billing enforcement
-   privileged writes
-   audit logging
-   complex transactional workflows

------------------------------------------------------------------------

# Core Security Rules for Functions

Every function must enforce the following rules before executing logic.

## Authentication Validation

All functions must validate:

request.auth != null

If the user is not authenticated, return:

    unauthenticated

## Organization Membership Validation

For any org-scoped function:

1.  Load membership record

org/{orgId}/members/{uid}

2.  Verify:

-   membership exists
-   membership.active == true

If not:

    permission_denied

## Role Validation

Roles allowed by the system:

-   owner
-   admin
-   inspector
-   viewer

Functions must verify role permissions depending on the operation.

Example:

  Role        Allowed Actions
  ----------- -----------------------
  owner       full access
  admin       management operations
  inspector   inspection operations
  viewer      read only

## Plan Validation

Functions must validate organization plan where required.

Plans:

-   basic
-   pro
-   elite
-   enterprise

Plan checks control features such as:

-   barcode scanning
-   GPS capture
-   photo uploads
-   route optimization
-   reporting tools

## Billing Validation

Billing state is stored in the organization document as a **cache of
Stripe state**.

Possible states:

-   active
-   trialing
-   past_due
-   unpaid
-   canceled

Write operations must verify billing state when appropriate.

------------------------------------------------------------------------

# Function Categories

Cloud Functions fall into several major categories.

1.  Authentication and onboarding
2.  Organization management
3.  Member and invite management
4.  Billing and Stripe integration
5.  Workspace lifecycle management
6.  Inspection workflows
7.  Asset management
8.  Reporting and exports
9.  Compliance and reminder systems
10. Scheduled maintenance jobs

------------------------------------------------------------------------

# Authentication and Onboarding

## createOrganization

Creates a new organization and assigns the caller as owner.

### Input

``` json
{
  "name": "Acme Hospital",
  "slug": "acme-hospital",
  "timezone": "America/Chicago"
}
```

### Behavior

-   Requires authenticated user
-   Creates:

org/{orgId}

-   Creates membership:

org/{orgId}/members/{uid}

role = owner

-   Creates or updates user document:

usr/{uid}

-   Sets:

defaultOrgId\
activeOrgId

-   Creates Stripe customer
-   Writes audit log

### Output

``` json
{
  "orgId": "generatedOrgId",
  "stripeCustomerId": "cus_xxxxx"
}
```

------------------------------------------------------------------------

# Member and Invite Management

## createInvite

Creates a pending invite to join an organization.

### Input

``` json
{
  "orgId": "org123",
  "email": "user@example.com",
  "role": "inspector"
}
```

### Behavior

-   Requires owner or admin
-   Prevents duplicate invites
-   Generates secure invite token
-   Stores **tokenHash only**
-   Sends optional email invite
-   Writes audit log

------------------------------------------------------------------------

## acceptInvite

Accepts an invitation and creates membership.

### Input

``` json
{
  "token": "rawInviteToken"
}
```

### Behavior

-   Requires authenticated user
-   Validates token hash
-   Ensures invite not expired
-   Confirms email matches invite
-   Creates membership
-   Updates invite status
-   Updates user's active organization
-   Writes audit log

------------------------------------------------------------------------

## changeMemberRole

Changes a member's role.

### Input

``` json
{
  "orgId": "org123",
  "targetUid": "user456",
  "newRole": "admin"
}
```

### Behavior

-   Requires owner or admin
-   Admin cannot modify owner
-   Updates membership role
-   Writes audit log

------------------------------------------------------------------------

## removeMember

Removes a member from an organization.

### Input

``` json
{
  "orgId": "org123",
  "targetUid": "user456"
}
```

### Behavior

-   Requires owner or admin
-   Cannot remove owner
-   Deactivates membership
-   Writes audit log

------------------------------------------------------------------------

## transferOwnership

Transfers organization ownership.

### Input

``` json
{
  "orgId": "org123",
  "newOwnerUid": "user456"
}
```

### Behavior

-   Requires current owner
-   Updates org.ownerUid
-   Promotes target member
-   Demotes previous owner
-   Writes audit log

------------------------------------------------------------------------

# Billing and Stripe Integration

## createCheckoutSession

Creates Stripe checkout session for subscription.

### Input

``` json
{
  "orgId": "org123",
  "plan": "pro"
}
```

### Behavior

-   Requires owner

-   Valid plans:

-   basic

-   pro

-   elite

Enterprise requires manual sales process.

Returns Stripe checkout URL.

------------------------------------------------------------------------

## createPortalSession

Creates Stripe customer portal session.

### Input

``` json
{
  "orgId": "org123"
}
```

### Behavior

-   Requires owner
-   Uses stored Stripe customer ID
-   Returns portal URL

------------------------------------------------------------------------

## stripeWebhook

Processes Stripe lifecycle events.

Handled events:

-   checkout.session.completed
-   customer.subscription.created
-   customer.subscription.updated
-   customer.subscription.deleted
-   invoice.payment_succeeded
-   invoice.payment_failed

### Behavior

-   Verifies webhook signature
-   Resolves org by Stripe customer
-   Updates organization billing cache
-   Updates plan features
-   Writes audit log

------------------------------------------------------------------------

# Workspace Lifecycle

## createWorkspace

Creates monthly inspection workspace.

### Input

``` json
{
  "orgId": "org123",
  "monthYear": "2026-03"
}
```

### Behavior

-   Requires owner/admin
-   Validates subscription
-   Prevents duplicate workspace
-   Seeds inspections
-   Writes audit log

------------------------------------------------------------------------

## archiveWorkspace

Archives a workspace.

### Input

``` json
{
  "orgId": "org123",
  "workspaceId": "2026-03"
}
```

### Behavior

-   Requires owner/admin
-   Generates final report
-   Locks inspections
-   Marks workspace archived
-   Writes audit log

------------------------------------------------------------------------

# Inspection Workflows

## upsertInspection

Creates or updates inspection.

### Input

``` json
{
  "orgId": "org123",
  "workspaceId": "2026-03",
  "extinguisherId": "ext789",
  "status": "pass",
  "checklistData": {},
  "notes": "All good",
  "gps": null,
  "photoPath": null
}
```

### Behavior

-   Requires inspector/admin/owner
-   Validates workspace active
-   Validates plan features
-   Updates inspection
-   Creates inspection event
-   Updates workspace stats

------------------------------------------------------------------------

# Asset Management

## replaceExtinguisher

Handles replacement lifecycle.

### Input

``` json
{
  "orgId": "org123",
  "oldExtinguisherId": "extOld",
  "newExtinguisherData": {}
}
```

### Behavior

-   Records replacement history
-   Updates serial and metadata
-   Preserves location
-   Logs audit event

------------------------------------------------------------------------

# Reporting and Exports

## generateReport

Creates report snapshot.

### Input

``` json
{
  "orgId": "org123",
  "workspaceId": "2026-03",
  "format": "pdf"
}
```

### Behavior

-   Requires authorized member
-   Generates or returns cached report
-   Saves report artifact in storage

------------------------------------------------------------------------

## exportData

Exports organization data.

### Input

``` json
{
  "orgId": "org123",
  "entity": "inspections",
  "format": "csv",
  "workspaceId": "2026-03"
}
```

### Behavior

-   Requires permission

-   Exports only org data

-   Supports:

-   CSV

-   Excel

-   JSON

------------------------------------------------------------------------

# Reminder and Compliance Systems

## generateReminders

Generates reminder alerts.

Triggers when:

-   monthly inspections due
-   annual inspections due
-   hydro tests due
-   six-year maintenance due

Reminders may generate:

-   dashboard alerts
-   email notifications
-   push notifications

------------------------------------------------------------------------

# Scheduled Maintenance Jobs

## expireInvitesJob

Expires stale invites.

## billingSyncJob

Ensures billing cache matches Stripe.

## complianceReminderJob

Generates inspection reminders.

## workspaceAutoCreateJob

Creates workspace for new month.

## retentionCleanupJob

Handles long-term archival cleanup.

------------------------------------------------------------------------

# Error Handling

All functions must return structured errors.

Example:

``` json
{
  "error": {
    "code": "permission_denied",
    "message": "You do not have access to this organization."
  }
}
```

Standard codes:

-   unauthenticated
-   permission_denied
-   invalid_argument
-   not_found
-   failed_precondition
-   resource_exhausted

------------------------------------------------------------------------

# Security Requirements

Every function must:

-   validate authentication
-   validate org membership
-   validate role permissions
-   validate billing status
-   prevent cross-org access
-   prevent client-controlled billing changes
-   log sensitive actions
