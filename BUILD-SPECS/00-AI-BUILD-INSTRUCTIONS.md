00 — AI Build Instructions

This file tells the AI builder exactly how to implement Extinguisher Tracker 3 (EX3).

The AI must treat the /docs folder as the source of truth.
If there is any conflict between assumptions, generated code, or undocumented preferences and the documents in /docs, the documents win.

The AI must not invent an alternative architecture that conflicts with these specifications.

Primary Goal

Build a production-ready, multi-tenant SaaS fire extinguisher inspection, compliance, and lifecycle management platform using Firebase and Stripe.

The application must support:

organization-based accounts

strict multi-tenant data isolation

role-based access control

subscription-based billing

plan-based feature gating

extinguisher inventory management

monthly inspection workflows

annual inspection tracking

6-year maintenance tracking

hydrostatic test tracking

barcode and QR asset tagging

inspection reminders and compliance alerts

audit history

offline-capable inspection workflows

exportable compliance reporting

legal inspection attestation

location hierarchy

inspection routes

extinguisher lifecycle tracking

future-ready compliance tooling

This is business software for companies and institutions, not a casual consumer app.

The application must feel trustworthy, fast, mobile-friendly, and audit-ready.

Product Context

Extinguisher Tracker 3 is designed for organizations such as:

hospitals

schools

universities

warehouses

manufacturing facilities

property managers

safety compliance teams

fire protection service companies

multi-site commercial organizations

The system is intended to help organizations stay compliant with NFPA 10 inspection and maintenance expectations while reducing missed inspections, improving documentation, and simplifying reporting for audits.

Required Tech Stack
Frontend

React

TypeScript

Vite

Tailwind CSS

React Router

Backend

Firebase Authentication

Firestore

Firebase Storage

Firebase Cloud Functions

Billing

Stripe

Optional / Future-Ready

PWA support

email delivery provider for notifications

analytics

error monitoring

map / floor plan integration

Required Architecture Rules

The AI must follow these architectural rules exactly.

Core Data Architecture

All business and operational data must be organization-scoped under org/{orgId}.

No operational business data may be stored under usr/{uid}.

No shared global collection may contain mixed operational data from multiple organizations.

Every protected query must be scoped to a single orgId.

Cross-organization operational queries are forbidden.

All reports, notifications, exports, and workflow records must be organization-scoped.

Identity and Membership

A user may belong to multiple organizations.

Data access must always be evaluated in the context of the currently active organization.

Being authenticated is not enough to access organization data.

Membership and role must always be checked.

Roles are organization-specific, not global.

Billing Architecture

Billing is organization-based, not user-based.

Stripe is the billing source of truth.

Firestore stores cached billing and plan state used by the application.

Enterprise is not self-serve unless explicitly enabled later.

Security Architecture

Cloud Functions must handle all privileged operations.

Firestore Security Rules must enforce tenant isolation and role-aware access.

Storage Rules must enforce organization-scoped file access.

The client must never be trusted for security-sensitive decisions.

Compliance Architecture

The platform must support NFPA-driven recurring workflows.

Compliance calculations must be data-driven and centralized.

Lifecycle logic must not be scattered across random components.

Archived compliance records must become read-only.

Multi-Tenant Isolation Requirements

The system is a strict multi-tenant SaaS platform.

Each organization is a separate tenant.

All operational data must live under:

org/{orgId}/...
Core Isolation Rule

An organization may only access its own data.

No organization may ever read, write, query, export, report on, or otherwise access another organization’s data.

The only exception is when the same authenticated user is an active member of more than one organization.
In that case, the user may access each organization separately, but only inside the currently selected organization context.

Required Isolation Behavior

a user must only see organizations they belong to

switching orgs must reload all org-scoped state and listeners

exports must include only one org’s data at a time

reports must include only one org’s data at a time

storage paths must include orgId

audit logs must be organization-scoped

notifications must be organization-scoped

offline caches must not mix records from multiple orgs

Forbidden Patterns

do not use global mixed-data collections for operational records

do not rely on client-side filtering for security

do not allow a user to manually supply another orgId and gain access

do not allow cross-org queries for normal application use

do not store operational data under user documents

Firestore Top-Level Model

The system must use these primary top-level collections:

org/{orgId}
usr/{uid}
invite/{inviteId}
Meaning

org = tenant / organization

usr = user profile metadata only

invite = pending organization invites

All business records must be stored under org/{orgId} subcollections.

Primary Organization Subcollections

The application must support subcollections such as:

org/{orgId}/members
org/{orgId}/locations
org/{orgId}/extinguishers
org/{orgId}/workspaces
org/{orgId}/inspections
org/{orgId}/inspectionEvents
org/{orgId}/reports
org/{orgId}/auditLogs
org/{orgId}/notifications
org/{orgId}/inspectionRoutes
org/{orgId}/settings

The exact final schema is defined in the database schema documents.

Privileged Operations

The client must not directly perform these operations through raw Firestore writes:

organization creation

organization deletion

invite creation

invite acceptance

ownership transfer

role changes

member suspension or removal where business rules apply

billing state updates

Stripe checkout session creation

Stripe portal session creation

Stripe webhook state synchronization

workspace creation when restricted by business logic

workspace archival

report generation

export artifact generation

tag reissue workflows that affect audit state

reminder generation

compliance batch recalculation

any workflow that modifies protected or authoritative state

These operations must be implemented through Cloud Functions or equally secure backend logic.

Plan Enforcement Rules

The AI must implement plan-based feature gating exactly as defined in 09-PLANS-PRICING.md.

Current Launch Pricing
Basic

$29.99/month

50 extinguishers included

+$10/month per additional 50 extinguishers

Pro

$99/month

250 extinguishers included

+$10/month per additional 50 extinguishers

Elite

$199/month

500 extinguishers included

+$10/month per additional 50 extinguishers

Enterprise

custom pricing

unlimited extinguishers

contact: help@beck-publishing.com

Required Plan Behavior
Basic

Must include:

manual barcode entry/search

inventory tracking

monthly inspection reminders

compliance dashboard

reports

lifecycle tracking

monthly compliance workflows

Must exclude:

camera barcode scanning

QR scanning

GPS capture

advanced field workflows reserved for Pro+

inspection routes if gated to higher plans

Pro

Must include:

everything in Basic

camera barcode scanning

QR scanning

GPS capture

audit logs

tag printing

inspection routes

photo documentation

advanced compliance workflows

Elite

Must include:

everything in Pro

higher extinguisher limit

advanced reporting

multi-site capable dashboards if implemented

priority support hooks if implemented later

Enterprise

Must include:

everything

unlimited extinguishers

contact-sales workflow

custom onboarding hooks

future API and technician portal readiness

Enforcement Layers

Feature access must be enforced in:

UI rendering

backend business logic

creation/import limit checks

export/report logic where needed

reminder logic where plan-aware

scanning access

notification access if plan-limited

Overage Logic

The app must support extinguisher overage billing logic conceptually:

each plan includes a base extinguisher limit

additional extinguishers may be billed at +$10/month per additional 50 extinguishers

overage handling must be centralized

downgrade logic must not automatically delete data

Compliance and NFPA Requirements

The application must support NFPA-driven workflows as specified in the compliance documents.

The system must support tracking of:

monthly visual inspections

annual certified inspections

6-year maintenance where applicable

hydrostatic testing based on extinguisher type

overdue compliance status

reminder notifications for due and approaching inspections

Monthly Inspection

Monthly visual inspections are required every 30 days.

Annual Inspection

Annual certified inspections are required every 12 months.

6-Year Maintenance

6-year internal maintenance applies where applicable based on extinguisher type/service class.

Hydrostatic Testing

Hydro intervals vary by extinguisher type and must be data-driven.

Examples:

CO2: 5 years by default

Water: 5 years by default

Wet Chemical: 5 years by default

many dry chemical categories: 12 years by default

The compliance engine must use configurable mappings rather than hardcoded UI-only logic.

Extinguisher Lifecycle Requirements

The application must implement an extinguisher lifecycle engine.

It must automatically calculate:

next monthly inspection

next annual inspection

next 6-year maintenance date

next hydrostatic test date

replacement / retirement state

compliance status

overdue flags

The lifecycle engine must be centralized.

The lifecycle system must support:

active

replaced

retired

removed

spare

out_of_service

The lifecycle engine must respect organization isolation and archived record integrity.

Reminder and Notification Requirements

The system must generate reminder notifications for upcoming inspections and compliance events.

Basic

Basic must include reminders so small businesses can use the system to stay compliant.

Pro, Elite, Enterprise

Must include reminders and advanced notification-ready workflows.

Minimum Reminder Expectations

monthly reminders

compliance due alerts

overdue alerts

Example reminder timing

monthly inspection: 7 days, 3 days, 1 day

annual inspection: 30 days

6-year maintenance: 60 days

hydro test: 90 days

Notifications must be organization-scoped and must not duplicate across tenants.

Asset Tagging Requirements

The system must support barcode and QR asset tagging.

Each extinguisher may have:

asset ID

barcode value

QR code value or QR link

tag print state

tag version

Basic

manual entry only

Pro and above

live camera scanning

QR scanning

tag printing

scan-to-open workflow

Tagging must never bypass authentication or org membership checks.

Audit Logging Requirements

The application must maintain audit history for important actions.

Examples:

inspection completed

inspection edited

extinguisher created

extinguisher deleted

extinguisher replaced

member invited

member role changed

report generated

export created

tag printed

tag reissued

Audit logs must be organization-scoped and append-only where appropriate.

Legal Inspection Attestation

This is a critical compliance feature.

When an inspection is completed, the inspector must confirm a legal attestation such as:

I certify this inspection was performed according to NFPA 10.

The system must store:

inspector name

inspector user ID

timestamp

digital confirmation / attestation flag

device ID or device context if available

This protects both customers and the platform during audits and disputes.

Offline Inspection Requirements

The application must support offline-capable inspection workflows.

Minimum requirements:

local inspection cache

queued sync

sync retry

conflict handling strategy

automatic upload when online again

The system must be designed so inspectors can continue work in low-connectivity environments such as basements, stairwells, and mechanical rooms.

Offline data must remain scoped by organization and not mix org data.

Location Hierarchy Requirements

The platform must support structured locations.

Examples:

campus

building

floor

wing

room

zone

The location model must support parent-child hierarchy.

This is necessary for:

large facilities

better reporting

better filtering

route planning

placement tools

Inspection Routes Requirements

The system should support inspection routes.

Routes define a logical order for inspecting multiple extinguishers.

This is especially useful for:

hospitals

campuses

warehouses

large buildings

Inspection routes must be organization-scoped and plan-aware if required.

Reports and Exports Requirements

The application must support exportable reports and compliance reporting.

Minimum formats:

CSV

Excel

JSON

The architecture should remain compatible with:

PDF compliance reports

archived report snapshots

downloadable audit-friendly reports

Reports must always be:

organization-scoped

permission-checked

plan-aware when required

immutable when archived

Suggested File and Folder Expectations

Suggested frontend structure:

src/
  app/
  components/
  pages/
  hooks/
  lib/
  features/
  contexts/
  routes/
  types/
  utils/
  services/
  store/

Suggested functions structure:

functions/
  src/
    index.ts
    auth/
    orgs/
    members/
    invites/
    billing/
    workspaces/
    inspections/
    reports/
    notifications/
    lifecycle/
    tags/
    utils/

Suggested Firebase project files:

src/lib/firebase.ts

firestore.rules

storage.rules

firebase.json

.firebaserc

Required Build Order

The AI should implement the project in this order:

Firebase project wiring

Authentication

Organization creation flow

Membership model

Firestore schema and typed data access

Firestore Security Rules

Storage Rules

Pricing page and Stripe integration

Organization switching

Dashboard shell

Inventory system

Location hierarchy

Asset tagging system

Workspace model

Inspection workflow

Reminder / notification system

Compliance engine

Lifecycle engine

Reports and exports

Audit logs

Offline sync hardening

Legal attestation flow

Final security / permission hardening

Coding Standards

Use TypeScript throughout

Use explicit types for Firestore models

Prefer predictable, maintainable code over clever abstractions

Keep components small and focused

Separate UI logic from business logic

Centralize plan checks

Centralize permission checks

Centralize compliance calculations

Centralize lifecycle calculations

Centralize reminder generation

Do not hardcode Stripe price IDs in UI components

Do not trust the client for security-sensitive decisions

Keep Firebase access logic organized and typed

Prefer reusable service modules for Firestore and Cloud Function interaction

Required Deliverables

The AI should generate:

React frontend

Firebase configuration

Firestore data access layer

Cloud Functions

Firestore Security Rules

Storage Rules

pricing page

plan-aware feature gating

authentication flow

organization switcher

org membership management screens

admin settings screens

inventory system

location hierarchy UI

inspection workflow

reminder/notification workflow

lifecycle calculation system

compliance reporting workflow

report/export workflow

audit log workflow

legal attestation support

asset tagging and scanning workflows

Data and Security Non-Negotiables

The AI must never do the following:

never allow cross-org data access

never rely on UI-only checks for security

never store operational org data under usr/{uid}

never let the client directly mutate billing state

never let the client directly assign privileged roles without backend verification

never create a user-centric architecture for org data

never expose another organization’s reports, files, logs, reminders, or exports

never bypass archived record locking

never allow inspection/legal attestation records to become casually editable after archival

Final Instruction

Build the application strictly according to the documents in this folder.

Do not improvise alternative architectures that violate the docs.

If an implementation detail is not explicitly specified, choose the simplest maintainable approach that still respects:

Firebase-first architecture

strict org isolation

role-based permissions

organization billing

plan-based limits

audit integrity

compliance tracking

lifecycle tracking

mobile field usability

secure backend workflows
