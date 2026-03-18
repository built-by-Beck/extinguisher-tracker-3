# 02 — Authentication, Organizations, and Billing

This document defines the authentication system, organization management, user roles and permissions, invitation workflow, organization switching behavior, account lifecycle rules, and Stripe subscription billing model for Extinguisher Tracker 3 (EX3).

The platform is **organization-centric**.

Users authenticate individually, but all operational data belongs to an organization.
Billing is also organization-level, not user-level.

The system must support:

- multi-tenant organization accounts
- multiple users per organization
- users belonging to multiple organizations
- secure invitation workflows
- role-based access control
- Stripe-managed subscription billing
- plan-based access control
- overage-aware pricing logic
- backend-controlled privileged operations

## Core Identity Model

The platform separates:

- authentication
- authorization
- organization membership
- billing

These are not the same thing.

### Authentication

Authentication answers:

**Who is this user?**

Handled by:

- Firebase Authentication

### Authorization

Authorization answers:

**What is this user allowed to do?**

Handled by:

- organization membership documents
- organization-specific roles
- Firestore Security Rules
- Cloud Function authorization checks
- plan-aware business rules where applicable

### Billing

Billing answers:

**What paid features and limits does this organization have access to?**

Handled by:

- Stripe
- cached billing fields on the organization document
- plan-aware backend and UI logic

## Authentication

### Identity Provider

**Firebase Authentication** is the identity provider for all users.

### Supported Sign-In Methods

#### Primary

- Email/password

#### Optional / Future-Ready

- Google SSO

The architecture should remain compatible with additional providers later if needed.

### Authentication Flow

1. User opens the application.
2. If unauthenticated, the user is redirected to the login or signup screen.
3. On signup, the user creates a Firebase Auth account.
4. After authentication, the application checks for an existing `usr/{uid}` document.
5. If no user document exists, one is created with default values.
6. The app checks the user's organization memberships.
7. If the user belongs to one or more organizations, the app loads the user's active organization context.
8. If the user belongs to no organization, the app routes the user into:
   - organization creation
   - or invite acceptance flow

**Authentication alone must never grant access to organization data.**

Membership and role must still be verified.

## User Document

User documents store user-level profile metadata only.

No operational business data should ever be stored under `usr/{uid}`.

### User Profile Shape

```
usr/{uid}
  displayName: string
  email: string
  photoURL: string | null
  defaultOrgId: string | null
  activeOrgId: string | null
  createdAt: timestamp
  updatedAt: timestamp
  lastLoginAt: timestamp | null
```

### Field Meaning

| Field | Meaning |
|-------|---------|
| `displayName` | user-facing display name |
| `email` | authenticated user email |
| `photoURL` | optional profile image |
| `defaultOrgId` | organization selected by default on login |
| `activeOrgId` | currently selected organization in the UI |
| `createdAt` / `updatedAt` / `lastLoginAt` | lifecycle metadata for the user account |

### Important Rule

User documents are not allowed to contain:

- extinguisher inventory
- inspection data
- reports
- notifications
- org-owned business records
- billing state

## Session Management

**Firebase Authentication** manages session tokens and login persistence.

### Client Behavior

- the client uses `onAuthStateChanged()` or equivalent auth listeners
- on logout, the app clears local organization state
- the app must unload active org-scoped listeners
- user is redirected to the login screen or public entry page

### Important Rule

A valid auth session does not automatically authorize access to organization data.

The app must still verify:

- organization membership
- membership status
- role permissions
- plan restrictions where relevant

## Organization Management

### Organization Document

Each organization is a tenant in the SaaS platform.

#### Organization Shape

```
org/{orgId}
  name: string
  slug: string | null
  ownerUid: string
  createdBy: string
  createdAt: timestamp
  updatedAt: timestamp
  deletedAt: timestamp | null

  plan: string | null                 // basic, pro, elite, enterprise
  assetLimit: number | null
  overLimit: boolean | null

  // Billing cache (Stripe is source of truth)
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null   // active, trialing, past_due, canceled, unpaid
  subscriptionPriceId: string | null
  subscriptionCurrentPeriodEnd: timestamp | null
  trialEnd: timestamp | null

  // Organization settings
  settings: {
    timezone: string
    sections: string[]
    defaultChecklistItems: string[]
  }

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
```

### Meaning of Key Organization Fields

#### Organization Identity

- `name`
- `slug`
- `ownerUid`
- `createdBy`

#### Lifecycle

- `createdAt`
- `updatedAt`
- `deletedAt`

#### Plan and Limits

- `plan`
- `assetLimit`
- `overLimit`

#### Billing Cache

- `stripeCustomerId`
- `stripeSubscriptionId`
- `subscriptionStatus`
- `subscriptionPriceId`
- `subscriptionCurrentPeriodEnd`
- `trialEnd`

#### Settings

- `timezone`
- `sections`
- configurable checklist defaults

#### Feature Flags

Feature flags may be cached on the org document for easy plan-aware UI and backend checks.

### Organization Creation Flow

**Organization creation is a privileged backend operation and must be handled by a Cloud Function.**

#### Flow

1. Authenticated user opens the Create Organization screen.
2. User enters organization details.
3. Client calls:

```
createOrganization({ name, slug?, timezone? })
```

4. The Cloud Function:
   - validates caller is authenticated
   - creates `org/{orgId}`
   - creates `org/{orgId}/members/{uid}` with role `owner`
   - creates or updates `usr/{uid}` with `defaultOrgId` and `activeOrgId`
   - creates a Stripe customer for the organization
   - stores the Stripe customer ID on the organization document
   - initializes default plan-related fields
   - writes an audit log entry if applicable
   - returns the `orgId`

5. Client redirects the owner to checkout or plan-selection flow.
6. Stripe webhook events later update the official billing fields.

#### Important Rule

The client must never create organizations through direct Firestore writes.

### Organization Switching

A user may belong to multiple organizations.

#### Active Organization Rules

- `usr/{uid}.activeOrgId` determines the currently loaded organization
- `usr/{uid}.defaultOrgId` determines which org loads by default at login
- switching orgs must reload all org-scoped listeners, caches, and data
- user may only switch into organizations where membership status is `active`

#### Required UX Behavior

When org switching happens, the app must:

- clear old org state
- unsubscribe old listeners
- load new org settings
- load new permissions
- load new plan state
- load new organization-scoped data

#### Critical Isolation Rule

A user may belong to multiple organizations, but the app must never mix records between them.

### Organization Ownership

Each organization has exactly one owner at a time.

#### Rules

- `org.ownerUid` is the canonical owner reference
- the corresponding member document must also have role `owner`
- ownership transfer must be handled by a Cloud Function
- admins cannot promote themselves to owner
- admins cannot remove or demote the current owner
- normal role editing must never accidentally break ownership state

## Membership and Roles

### Member Document

Membership is organization-specific and stored under the organization.

#### Member Shape

```
org/{orgId}/members/{uid}
  uid: string
  email: string
  displayName: string
  role: string                       // owner, admin, inspector, viewer
  status: string                     // active, invited, suspended, removed
  invitedBy: string | null
  joinedAt: timestamp | null
  createdAt: timestamp
  updatedAt: timestamp
```

#### Member Rules

- document ID is the Firebase Auth UID
- membership is per-organization
- status must be checked as well as role
- role changes are privileged operations
- ownership transfer is not a normal role edit

### Role Definitions

#### Owner

The owner has the highest level of authority in the organization.

**Owner Permissions**

- manage billing
- manage subscription
- transfer ownership
- invite members
- remove members
- change member roles
- manage settings
- manage locations
- manage extinguisher inventory
- create/archive workspaces
- perform inspections
- access all reports and exports
- trigger org deletion through backend workflow

#### Admin

Admins operate the organization but do not control ownership or billing.

**Admin Permissions**

- invite members
- remove members except owner
- change member roles except owner transfer
- manage sections and organization settings
- import and export data
- create and archive workspaces
- manage extinguisher inventory
- manage locations
- perform inspections
- view reports and operational history

**Admin Restrictions**

- cannot manage billing
- cannot transfer ownership
- cannot remove owner
- cannot demote owner
- cannot delete organization

#### Inspector

Inspectors are field users.

**Inspector Permissions**

- perform inspections
- complete checklist items
- add notes
- capture photos if plan allows
- capture GPS if plan allows
- scan barcode or QR if plan allows
- use field workflows necessary for inspections
- view operational data needed for assigned work

**Inspector Restrictions**

- cannot manage billing
- cannot manage members
- cannot manage org settings
- cannot archive workspaces
- cannot change roles
- cannot delete the organization

**Limited Update Rule**

Inspectors may update only workflow-safe inspection-related fields when business rules permit.

#### Viewer

Viewers are read-only users.

**Viewer Permissions**

- read extinguisher data
- read inspection results
- read reports
- read photos/history if access is allowed

**Viewer Restrictions**

- cannot perform inspections
- cannot modify data
- cannot manage users
- cannot manage settings
- cannot manage billing

### Role Permission Matrix

| Action | Owner | Admin | Inspector | Viewer |
|--------|-------|-------|-----------|--------|
| Manage billing | Yes | No | No | No |
| Transfer ownership | Yes | No | No | No |
| Delete organization via backend workflow | Yes | No | No | No |
| Invite members | Yes | Yes | No | No |
| Remove members | Yes | Yes | No | No |
| Change member roles | Yes | Yes\* | No | No |
| Manage organization settings | Yes | Yes | No | No |
| Import data | Yes | Yes | No | No |
| Export data | Yes | Yes | No | Yes\*\* |
| Create workspace | Yes | Yes | No | No |
| Archive workspace | Yes | Yes | No | No |
| Add extinguisher | Yes | Yes | No | No |
| Edit extinguisher | Yes | Yes | Limited\*\*\* | No |
| Delete extinguisher | Yes | Yes | No | No |
| Perform inspection | Yes | Yes | Yes | No |
| Replace extinguisher in workflow | Yes | Yes | Limited\*\*\*\* | No |
| Capture photo | Yes | Yes | Yes | No |
| Capture GPS | Yes | Yes | Yes | No |
| Scan barcode / QR | Yes | Yes | Yes | No |
| View operational data | Yes | Yes | Yes | Yes |
| View reports | Yes | Yes | Yes | Yes |
| Manage section notes | Yes | Yes | Yes | No |

\* Admin cannot change owner role or remove owner.
\*\* Viewer export access depends on product/export rules.
\*\*\* Inspector may edit only limited workflow-safe fields if allowed.
\*\*\*\* Replacement workflows for inspectors must be constrained, audited, and permission-checked.

## Invitation System

### Invite Document

Invites are stored in a top-level collection because they may be resolved before the user fully enters the organization.

#### Invite Shape

```
invite/{inviteId}
  orgId: string
  orgName: string
  email: string
  role: string
  invitedBy: string
  invitedByEmail: string
  status: string                     // pending, accepted, expired, revoked
  tokenHash: string
  createdAt: timestamp
  expiresAt: timestamp
  acceptedAt: timestamp | null
  revokedAt: timestamp | null
```

#### Important Rule

Invite tokens must never be stored in raw form.

Only a hashed token may be stored.

### Invite Flow

1. Owner or admin starts invite flow from organization settings.
2. User enters invitee email and target role.
3. Client calls:

```
createInvite({ orgId, email, role })
```

4. The Cloud Function:
   - validates caller has permission
   - validates requested role is allowed
   - checks for duplicate pending invites
   - generates secure invite token
   - stores only `tokenHash`
   - creates invite document
   - optionally sends invite email
   - returns invite link

5. Invitee opens a link like:

```
/invite/{token}
```

6. If unauthenticated, invitee signs in or signs up.
7. Client calls:

```
acceptInvite({ token })
```

8. The Cloud Function:
   - hashes submitted token
   - resolves pending invite
   - validates invite is pending, not expired, not revoked
   - validates authenticated user email matches invite email
   - creates or updates `org/{orgId}/members/{uid}`
   - sets membership status to `active`
   - sets `joinedAt`
   - updates invite status to `accepted`
   - updates `usr/{uid}.activeOrgId` if needed
   - optionally updates `defaultOrgId`
   - writes audit log if applicable
   - returns success

9. Client redirects user into the organization dashboard.

### Invite Management Rules

- pending invites can be revoked by owner or admin
- expired invites cannot be accepted
- duplicate pending invites for same org/email are not allowed
- accepted invites remain stored for audit/history
- invite acceptance must always be server-side
- invite resolution must not bypass authentication

## Stripe Billing Integration

### Billing Model

Billing is organization-level, not user-level.

Each organization has:

- one Stripe customer
- one active subscription at a time
- one active plan
- plan-specific feature access
- plan-specific included extinguisher count
- possible overage billing logic

### Launch Plan Structure

#### Basic

- $29.99/month
- 50 extinguishers included
- +$10/month per additional 50 extinguishers
- includes reminders and compliance notifications
- manual entry only for barcode/asset lookup

#### Pro

- $99/month
- 250 extinguishers included
- +$10/month per additional 50 extinguishers
- includes scanning, GPS, photo workflows, routes, tagging, advanced workflows

#### Elite

- $199/month
- 500 extinguishers included
- +$10/month per additional 50 extinguishers
- includes everything in Pro plus higher scale and advanced reporting support

#### Enterprise

- custom pricing
- unlimited extinguishers
- contact: help@beck-publishing.com

### Stripe Objects Used

| Object | Description |
|--------|-------------|
| Customer | one per organization |
| Subscription | one active subscription per organization |
| Price | recurring monthly price configured in Stripe |
| Checkout Session | used for self-serve plan signup |
| Customer Portal Session | used for billing self-service |

Enterprise may remain outside self-serve checkout.

### Checkout Flow

1. After organization creation, owner starts checkout.
2. Client calls:

```
createCheckoutSession({ orgId, plan })
```

3. The Cloud Function:
   - validates caller is authenticated
   - validates caller is org owner
   - validates selected plan is self-serve
   - rejects enterprise self-serve if disabled
   - loads org Stripe customer ID
   - maps selected plan to correct Stripe price ID
   - creates Stripe Checkout session with:
     - customer
     - mode = subscription
     - correct recurring price
     - optional trial settings
     - `metadata.orgId`
     - success URL
     - cancel URL
   - returns checkout URL

4. Client redirects user to Stripe Checkout.
5. Stripe sends webhook events after checkout completes.
6. Webhook handlers update organization billing fields.

### Customer Portal Flow

1. Owner clicks **Manage Billing**.
2. Client calls:

```
createPortalSession({ orgId })
```

3. The Cloud Function:
   - validates caller is owner
   - loads Stripe customer ID
   - creates Stripe Customer Portal session
   - returns portal URL

4. Client redirects to Stripe billing portal.
5. Any subscription changes are reflected through webhook updates.

### Stripe Webhook Events

The following webhook events must be handled:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | associate completed checkout with org and sync plan/subscription |
| `customer.subscription.created` | set initial subscription fields |
| `customer.subscription.updated` | update plan, status, period, price |
| `customer.subscription.deleted` | mark subscription canceled |
| `invoice.payment_succeeded` | clear failure state, update period |
| `invoice.payment_failed` | mark org `past_due` or `unpaid` |
| `customer.subscription.trial_will_end` | optional reminder workflow |

**Webhook logic must always be authoritative over client assumptions.**

### Billing Cache and Plan State

**Stripe is the billing source of truth.**

Firestore stores cached copies of:

- subscription status
- selected plan
- price reference
- period end
- trial state
- feature flags if cached
- asset limit if cached

#### Rules

- billing cache is updated by webhook handlers or trusted backend sync
- client reads billing state from Firestore, not directly from Stripe
- stale cache may be corrected by backend sync
- client must never directly mutate official billing fields

### Subscription Status and Access

Subscription status determines organization access level.

#### Supported Statuses

- `active`
- `trialing`
- `past_due`
- `canceled`
- `unpaid`
- no subscription

#### Recommended Access Rules

| Status | Access |
|--------|--------|
| `active` | full access based on plan |
| `trialing` | full access based on plan |
| `past_due` | read-only or grace-period limited behavior |
| `canceled` | read-only for retention period, then export-only or restricted recovery |
| `unpaid` | billing recovery required |
| no subscription | owner is redirected to checkout |

### Enforcement Layers

#### 1. Client-Side Enforcement

Used for UX only.

Examples:

- hide buttons
- disable workflows
- show upgrade messages
- show billing banners

#### 2. Firestore Security Rules

Used to restrict reads/writes where appropriate based on:

- authentication
- active membership
- role
- allowed subscription status

#### 3. Cloud Functions

Used to enforce privileged and billing-aware workflows such as:

- workspace creation
- archival
- imports
- ownership actions
- member management
- report generation
- plan-aware over-limit enforcement

## Plan and Overage Enforcement

The system must support included extinguisher limits and overage rules.

### Included Limits

- Basic: 50
- Pro: 250
- Elite: 500
- Enterprise: unlimited

### Overage Logic

- additional extinguishers may be billed in 50-unit increments
- each extra 50 extinguishers adds +$10/month
- overage rules must be centralized
- app must prevent silent uncontrolled over-limit growth if billing enforcement requires restriction

### Downgrade Rule

If a customer downgrades below their current active extinguisher count:

- existing data must remain intact
- system may mark org `overLimit`
- customer may be prevented from adding more extinguishers until usage fits plan or plan is upgraded
- data must not be automatically deleted

## Security Rules Summary

Firestore Security Rules must enforce:

- authenticated users can only access their own `usr/{uid}` document
- organization data requires active membership
- writes must be role-aware
- subscription-aware restrictions may apply to writes
- client code is never a security boundary
- invite acceptance must validate authenticated email matches invite
- sensitive operations remain backend-controlled
- organization switching must not bypass membership
- org isolation must apply to reports, notifications, and exports as well

Detailed rules are defined in the schema and isolation documents.

## Account Deletion

### User Account Deletion

User deletion must be handled by Cloud Function.

#### Flow

1. user requests account deletion
2. backend checks whether user is sole owner of any org
3. if sole owner, ownership transfer or org deletion must happen first
4. backend removes user from memberships as appropriate
5. backend writes audit logs
6. backend deletes `usr/{uid}`
7. backend deletes Firebase Auth account

### Organization Deletion

Organization deletion must be a privileged backend workflow.

#### Flow

1. only owner may request deletion
2. backend validates ownership and recent auth if required
3. backend cancels Stripe subscription if needed
4. backend soft-deletes org with `deletedAt`
5. org enters retention state
6. restoration may be allowed during retention if business rules allow
7. scheduled backend job later performs hard delete or archival cleanup
8. deletion is logged

## Design Rules

The following rules must always be respected:

- authentication does not equal authorization
- all operational data is organization-scoped
- billing belongs to the organization, not the user
- organization membership is the basis for access control
- roles are organization-specific
- **Stripe** is the source of truth for subscription state
- **Firestore** is the source of truth for application data
- **Cloud Functions** handle privileged operations
- invite tokens must never be stored raw
- ownership transfer must always be explicit and backend-controlled
- plan restrictions must not live only in the UI
- overage handling must be centralized
- enterprise setup must remain admin/contact-sales aware if not self-serve
