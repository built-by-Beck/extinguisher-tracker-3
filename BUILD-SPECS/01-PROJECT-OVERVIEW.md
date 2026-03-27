# 01 — Project Overview

These documents define the complete architecture, product requirements, technical specifications, and implementation rules for building **Extinguisher Tracker 3 (EX3)** from the ground up.

**Extinguisher Tracker 3** is a multi-tenant SaaS fire extinguisher inspection, compliance, lifecycle, and reporting platform designed for organizations that must manage portable fire extinguisher programs in a structured, audit-ready way.

The application is intended for organizations such as:

- hospitals
- schools
- universities
- warehouses
- manufacturing facilities
- commercial property managers
- facility maintenance teams
- safety compliance teams
- fire protection service companies
- multi-site organizations

This is a ground-up rebuild of a previous single-user application.

The new system is **organization-centric** rather than user-centric.
All operational data belongs to an organization, not to individual users.

Multiple users collaborate within the same organization and share the same operational dataset, subject to role-based permissions.

## Product Purpose

Extinguisher Tracker 3 is designed to help organizations:

- manage extinguisher inventory
- perform and document monthly inspections
- track annual inspection requirements
- track 6-year maintenance requirements where applicable
- track hydrostatic testing intervals by extinguisher type
- maintain compliance reminders and due-date alerts
- generate compliance reports for audits
- maintain historical inspection and maintenance records
- manage extinguisher lifecycle events such as replacement and retirement
- use barcode and QR asset tags for fast field workflows
- support multiple users and multiple buildings within one organization
- operate in real-world field conditions, including weak or intermittent connectivity

The platform is not just an inventory app.
It is intended to become a **professional fire safety compliance platform**.

## Core Product Capabilities

The platform must support the following major capabilities:

- extinguisher inventory management
- barcode and QR-based asset identification
- manual asset search
- monthly inspection workspaces
- NFPA-aligned monthly inspection checklist workflows
- annual inspection tracking
- 6-year maintenance tracking where applicable
- hydrostatic testing interval tracking by extinguisher type
- photo documentation
- GPS capture
- reminder notifications
- compliance alerts
- real-time collaboration between inspectors
- append-only audit history where required
- exportable reports and compliance documentation
- legal inspection attestation
- location hierarchy
- inspection routes
- offline-capable inspection workflows
- Stripe subscription billing
- plan-based feature access
- multi-tenant organization isolation

## Document Index

### 00 — AI Build Instructions

Defines the rules the AI builder must follow, including architecture rules, implementation priorities, and security expectations.

### 01 — Project Overview

This file. High-level architecture, product direction, system purpose, and design philosophy.

### 02 — Authentication, Organizations, and Billing

Authentication flow, organization creation, memberships, roles, invite handling, and Stripe subscription behavior.

### 03 — Database Schema

Complete Firestore schema including collections, subcollections, key fields, and structural rules.

### 04 — Feature Specification

Detailed product features, behaviors, acceptance rules, and feature gating expectations.

### 05 — UI Components

Primary screens, components, dashboard behavior, page layouts, and user-facing flows.

### 06 — Business Logic

Core rules for inspections, plan enforcement, compliance calculations, lifecycle behavior, and other platform logic.

### 07 — API and Cloud Functions

Privileged operations handled through Firebase Cloud Functions and backend workflows.

### 08 — Reports and Exports

Compliance reporting, archive snapshots, export formats, and reporting access rules.

### 09 — Plans and Pricing

Subscription tiers, included features, plan limits, overage rules, and pricing logic.

### 10 — Multi-Tenant Isolation

Strict tenant isolation rules, organization-scoped queries, and forbidden cross-org patterns.

### 11 — NFPA Compliance System

NFPA-related tracking requirements including monthly inspections, annual inspections, 6-year maintenance, and hydrostatic testing.

### 12 — Extinguisher Lifecycle Engine

Lifecycle calculations, due dates, replacement/retirement tracking, and compliance status behavior.

### 13 — Barcode and QR Asset Tagging

Asset tagging, barcode and QR scanning, tag generation, tag printing, and scan-to-record workflows.

### 14 — Audit Logging System

System-wide audit history requirements and event logging expectations.

### 15 — Location Hierarchy

Hierarchical facility location model for campuses, buildings, floors, wings, zones, and rooms.

### 16 — Inspection Routes

Route-based inspection workflows for walking paths and grouped inspection assignments.

### 17 — Offline Sync System

Offline-capable inspection workflows, caching, queued sync, and recovery behavior.

### 18 — Legal Inspection Attestation

Attestation requirements for legally defensible inspection records.

### 19 — Extinguisher Placement Calculator

Integration path for extinguisher planning and placement recommendation workflows.

## High-Level Architecture

### Application Type

The system is a **single-page application (SPA)** backed by Firebase services and Cloud Functions.

The client application interacts directly with Firestore and Firebase Storage for standard authenticated operations, while privileged workflows are handled by Cloud Functions.

The architecture does not use a traditional monolithic backend server.

Instead, the application is built on:

- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Cloud Functions
- Stripe

This design keeps the platform serverless, scalable, and aligned with Firebase-first SaaS architecture.

### Core Architecture Principles

#### 1. Organization-Centric Data Model

All operational data belongs to an organization.

Users authenticate individually, but they work inside one or more organizations.

No operational records belong directly to the user profile.

Examples of organization-owned records:

- extinguishers
- workspaces
- inspections
- routes
- reports
- audit logs
- notifications
- settings

#### 2. Strict Multi-Tenant Isolation

The system is a **strict multi-tenant SaaS platform**.

All protected operational data must live under:

```
org/{orgId}/...
```

A user may only access data for organizations where they are an active member.

If a user belongs to multiple organizations, the user may switch between them, but data must remain strictly separated by active organization context.

No user may access another organization's data unless they are also a member of that organization.

Cross-organization operational queries are forbidden.

#### 3. Role-Based Access Control

Users have roles within an organization.

Supported roles:

- **Owner**
- **Admin**
- **Inspector**
- **Viewer**

Permissions must be enforced through:

- Firestore Security Rules
- Cloud Function authorization checks
- plan-aware backend logic where needed

Role access is organization-specific, not global.

A user could be:

- Owner in one organization
- Viewer in another

#### 4. Offline-First Field Design

Inspectors often work in locations with poor connectivity, such as:

- stairwells
- basements
- utility rooms
- parking decks
- mechanical spaces

The application must support **offline-capable inspection workflows**.

This includes:

- local caching
- queued writes
- recovery when connectivity returns
- protection against cross-org cache mixing
- sync-safe inspection handling

Offline support is a **core product requirement**, not a nice extra.

#### 5. Real-Time Collaboration

Multiple inspectors may work inside the same organization at the same time.

Firestore real-time listeners allow:

- live progress updates
- synchronized inspection counts
- shared workspace visibility
- collaborative operational awareness

The application must remain stable when multiple users work simultaneously.

#### 6. Stripe as Billing Source of Truth

Stripe manages all subscription and pricing logic.

Firestore stores a cached representation of:

- selected plan
- subscription status
- billing-related org fields
- feature flags if required

Stripe updates are synchronized through webhook-driven Cloud Functions.

The client must not directly write billing authority fields.

#### 7. Plan-Aware Product Architecture

This product is subscription-driven and feature-gated by plan.

The architecture must support:

- **Basic**
- **Pro**
- **Elite**
- **Enterprise**

The application must enforce:

- included extinguisher counts
- overage pricing logic
- feature access restrictions
- scanning permissions
- reminder availability
- route availability
- advanced workflow access

Plan behavior must not live only in the UI.
It must be reflected in backend logic and data enforcement.

#### 8. Compliance-Driven Design

The platform must support real compliance workflows, not just simple checklist storage.

The architecture must support:

- monthly inspections
- annual inspections
- 6-year maintenance where applicable
- hydrostatic test intervals by extinguisher type
- due-date calculations
- reminder notifications
- archived compliance records
- legal attestation
- audit-ready reporting

## Technology Stack

### Frontend

The frontend stack must include:

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide React or equivalent icon library
- ExcelJS or equivalent export tooling
- barcode/QR scanning support through browser/device APIs and libraries

Primary frontend goals:

- mobile-friendly field workflows
- clean B2B interface
- fast navigation
- clear compliance visibility
- scalable component structure

### Backend Infrastructure

Firebase provides the application backend.

#### Firebase Authentication

Used for:

- user identity
- sign-in
- session state
- account ownership

Supported providers:

- email/password
- Google SSO (optional / future-ready)

#### Firestore

Used as the primary application database.

Stores:

- organizations
- user metadata
- memberships
- extinguisher inventory
- workspaces
- inspections
- routes
- notifications
- reports
- audit logs
- lifecycle fields
- settings

#### Firebase Storage

Used for:

- inspection photos
- extinguisher photos
- generated report files
- generated tag files
- future import/export artifacts

#### Firebase Cloud Functions

Used for privileged and trusted backend workflows.

Examples include:

- organization creation
- invite creation
- invite acceptance
- role changes
- Stripe checkout session creation
- Stripe portal session creation
- Stripe webhooks
- workspace archival
- report generation
- reminder generation
- lifecycle/compliance calculations where centralized
- legal attestation workflows where required
- cleanup and scheduled jobs

### Payments

Stripe manages billing.

The product uses Stripe for:

- subscription checkout
- recurring billing
- plan management
- billing portal access
- subscription lifecycle updates
- webhook-driven billing synchronization

## Launch Pricing Model

#### Basic

- $29.99/month
- 50 extinguishers included
- +$10/month per additional 50 extinguishers

#### Pro

- $99/month
- 250 extinguishers included
- +$10/month per additional 50 extinguishers

#### Elite

- $199/month
- 500 extinguishers included
- +$10/month per additional 50 extinguishers

#### Enterprise

- custom pricing
- unlimited extinguishers
- contact: info@extinguishertracker.com

## Deployment Model

Deployment is fully serverless.

- **Frontend** — Firebase Hosting serves the SPA.
- **Backend** — Cloud Functions handle trusted backend workflows.
- **Data** — Firestore stores structured application data.
- **Files** — Firebase Storage stores uploaded and generated assets.
- **Payments** — Stripe handles subscriptions and billing.

This architecture should remain simple, scalable, and cost-aware.

## Environment Configuration

### Frontend Environment Variables

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_STRIPE_PUBLISHABLE_KEY`

### Backend / Cloud Functions Environment Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_BASIC`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ELITE`

Additional config may be added later for:

- email delivery
- analytics
- maps
- reporting tools

## Top-Level Firestore Model

The system uses three primary top-level collections:

```
org/{orgId}
usr/{uid}
invite/{inviteId}
```

- `org` — Represents an organization / tenant / customer account. All operational data exists under `org/{orgId}`.
- `usr` — Represents user profile metadata tied to Firebase Authentication. Contains user-level metadata only, not operational organization data.
- `invite` — Represents pending invitations before membership is accepted.

### Organization Subcollections

Each organization document may contain subcollections such as:

- `org/{orgId}/members`
- `org/{orgId}/locations`
- `org/{orgId}/extinguishers`
- `org/{orgId}/workspaces`
- `org/{orgId}/inspections`
- `org/{orgId}/inspectionEvents`
- `org/{orgId}/reports`
- `org/{orgId}/auditLogs`
- `org/{orgId}/notifications`
- `org/{orgId}/inspectionRoutes`
- `org/{orgId}/settings`

All operational records must be organization-scoped.

## User Roles

Users have organization-specific roles.

#### Owner

- full administrative access
- billing access
- membership control
- organization-level authority

#### Admin

- manages team members except owner-only powers
- manages settings, locations, and extinguishers
- may manage workspaces and reports

#### Inspector

- performs inspections
- uses field workflows
- uploads photos where allowed
- scans tags where allowed

#### Viewer

- read-only visibility
- reports and oversight access

Permissions are enforced by:

- Firestore Security Rules
- Cloud Functions
- plan-aware logic where applicable

## Monthly Workspace Model

The system uses **monthly inspection workspaces**.

Each organization has one workspace per inspection period.

Example key: `2026-03`

Workspace behavior:

- created automatically or manually
- tracks inspection progress
- aggregates state and counts
- becomes read-only when archived
- remains available for reporting after archival

Archived workspaces must preserve audit integrity.

## Asset Identity Rules

Each extinguisher must have a stable identity.

Rules:

- asset IDs must be unique within an organization
- barcodes must be stored as strings
- serial numbers must be stored as strings
- QR values must be stored as strings
- duplicate tag values must be handled carefully
- extinguishers may initially exist without barcodes
- barcode and QR assignment must be supported later
- replacement workflows must preserve historical identity linkage

## Audit and Compliance Integrity

The system must preserve historical truth.

Requirements:

- inspection timestamps must not be casually overwritten
- inspector identity must be preserved
- archived workspaces must be read-only
- legal attestation must be stored
- administrative corrections must create audit entries
- audit logs must be append-only where required
- reports must preserve compliance snapshots
- lifecycle history must remain traceable

This is critical for **audit trustworthiness**.

## Sources of Truth

| Component | Source of Truth |
|---|---|
| User identity | Firebase Authentication |
| Application data | Firestore |
| Billing | Stripe |
| Privileged workflows | Cloud Functions |
| Access enforcement | Firestore Security Rules |
| File access | Firebase Storage Rules |

## Architectural Constraints

The system must follow these rules:

- do not store operational data under user documents
- do not implement a user-centric architecture
- do not allow cross-organization queries
- do not trust client-side permission checks as security
- do not allow client code to assign roles or modify billing state
- do not create a separate Firestore database per organization
- do not allow archived compliance records to be casually rewritten
- do not let scanning bypass auth or org membership
- do not let reports include more than one organization's data at a time

All privileged state changes must occur through secure backend workflows.

## Core User Journey

A typical core journey looks like this:

1. Owner signs up
1. Owner creates organization
1. Owner selects subscription plan
1. Owner imports or creates extinguisher inventory
1. Owner invites team members
1. Monthly workspace is created
1. Inspectors perform inspections in the field
1. Inspectors search or scan extinguisher records
1. Inspectors complete inspection checklist and attestation
1. Compliance and lifecycle state update automatically
1. Notifications and dashboards surface due or overdue items
1. Workspace is archived
1. Compliance reports are generated or exported as needed

## Non-Functional Requirements

### Performance

- application should load quickly on typical business internet and 4G mobile connections
- normal actions should feel responsive
- common dashboards and inventory views must scale to large org datasets

### Security

- strict tenant isolation is mandatory
- secure auth, membership, and rule enforcement are required
- privileged operations must be backend-controlled

### Scalability

The system should support organizations with:

- thousands of extinguishers
- multiple facilities
- multiple simultaneous inspectors
- long historical records

### Mobile Usability

The interface must work well on:

- phones
- tablets
- laptops used in the field

### Reliability

- offline use must not lose inspection data
- sync workflows must recover gracefully
- archived records must remain stable

### Compliance

- archived inspection records must remain immutable
- attestation and identity records must be preserved
- due dates and lifecycle status must be explainable and traceable

## Build Phases

### Phase 1 — Foundation

- Firebase project setup
- auth flow
- organization provisioning
- memberships and roles
- Firestore schema
- security rules
- dashboard shell

### Phase 2 — Core Operations

- locations
- extinguisher inventory CRUD
- import flows
- manual search
- barcode/QR identity fields
- workspace creation
- inspection workflow basics

### Phase 3 — Field Operations

- barcode scanning
- QR scanning
- photo uploads
- GPS capture
- inspection routes
- offline support
- real-time collaboration

### Phase 4 — Compliance and Lifecycle

- monthly reminders
- annual inspection tracking
- 6-year maintenance tracking
- hydro test tracking
- lifecycle calculations
- compliance dashboards
- archived workspace logic
- legal attestation

### Phase 5 — SaaS and Reporting

- Stripe billing integration
- pricing page
- subscription enforcement
- plan-aware features
- notifications
- reports and exports
- audit logs

### Phase 6 — Hardening and Expansion

- performance optimization
- security rule testing
- edge-case handling
- monitoring
- placement calculator integration
- future technician/service workflows

## Product Vision

Extinguisher Tracker 3 is intended to evolve beyond a simple inspection tracker.

The long-term product vision is a **modern fire safety compliance platform** that helps organizations:

- plan extinguisher placement
- manage extinguisher inventory
- track inspections and maintenance
- stay compliant
- produce audit-ready records
- improve operational efficiency
- scale across multiple sites

The application should be designed in a way that supports growth into a serious B2B product.
