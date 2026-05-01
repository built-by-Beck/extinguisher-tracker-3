# Extinguisher Tracker 3 (EX3)

<p align="center">
  <img src="media/extinguisherTracker.png" alt="Extinguisher Tracker 3 Logo" width="200" />
</p>

<p align="center">
  <strong>Professional fire extinguisher inspection, compliance, and lifecycle management.</strong><br/>
  A multi-tenant SaaS platform built for organizations that need to stay NFPA 10 compliant.
</p>

<p align="center">
  <a href="https://extinguisher-tracker-3.web.app">Production</a> &bull;
  <a href="https://extinguisher-tracker-3--dev-2zat4bfo.web.app">Dev Preview</a>
</p>

---

## Overview

For AI-assisted development, see [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) (PBRD Lite + Full PBRD) and keep inspection list/count logic in `src/utils/workspaceInspectionStats.ts`.

Extinguisher Tracker 3 replaces paper binders and disconnected spreadsheets with a real-time, audit-ready inspection platform. It is designed for hospitals, schools, warehouses, manufacturing facilities, property management companies, and fire protection service providers.

The system is **organization-centric** — all operational data belongs to the organization, not individual users. Multiple team members collaborate within a shared dataset governed by role-based permissions.

## Key Features

- **Barcode & QR Scanning** — Use your phone camera to instantly look up extinguishers in the field
- **NFPA 10 Compliance Engine** — Monthly, annual, 6-year maintenance, and hydrostatic testing intervals tracked automatically
- **Inspection Workspaces** — Organize monthly inspections by workspace with section progress tracking
- **AI Maintenance Helper** — Built-in assistant trained on NFPA 10 standards for on-the-fly compliance questions
- **Section Auto Timer** — Automatically tracks section timing to keep inspection routes on pace
- **Placement Calculator** — Determine required extinguisher quantities and types based on hazard class and floor area
- **Offline Support** — Perform inspections in areas with no connectivity; data syncs automatically when back online
- **Compliance Dashboard** — Real-time visibility into passed, failed, and overdue inspections across your organization
- **Location Hierarchy** — Organize assets by building, floor, section, and vicinity
- **Inspection Routes** — Pre-configured walking routes for efficient field workflows
- **Photo & GPS Documentation** — Capture photographic evidence and location data during inspections
- **Lifecycle Tracking** — Full extinguisher history from installation through retirement
- **Expiration Planning Lists** — Separate official marked-expired inventory from advisory 6+ year manufacture-date candidates
- **Audit Logs** — Append-only, immutable compliance records for regulatory audits
- **Reports & Exports** — Generate compliance reports in CSV, Excel, and JSON formats
- **Legal Attestation** — Digital inspection sign-off for regulatory compliance
- **Tag / QR Label Printing** — Generate and print asset tags for physical extinguishers
- **Multi-Tenant Isolation** — Strict data separation between organizations at every layer
- **Role-Based Access** — Owner, Admin, Inspector, and Viewer roles with granular permissions
- **Real-Time Collaboration** — Multiple inspectors working simultaneously with live updates
- **Data Restore Tools** — JSON backup restoration with automatic duplicate detection

### AI reference edition policy

- AI guidance defaults to **NFPA 10 (2022)** references.
- Organizations operating under different adopted editions should align AI usage to local AHJ requirements.
- AI responses are operational guidance and should be validated by qualified personnel before final compliance decisions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Vite 8 |
| **Backend** | Firebase (Cloud Functions v2, Firestore, Auth, Hosting, Storage) |
| **Runtime** | Node.js 22 |
| **Payments** | Stripe (webhook-driven subscription management) |
| **Icons** | Lucide React |
| **Barcode** | @undecaf/barcode-detector-polyfill |
| **Spreadsheets** | SheetJS (xlsx) |
| **QR Generation** | qrcode |
| **Testing** | Vitest, Testing Library, jsdom |
| **Package Manager** | pnpm |

## Project Structure

```
extinguisher-tracker-3/
├── src/                        # Frontend application
│   ├── app/                    # App-level configuration
│   ├── components/             # Shared UI components
│   ├── contexts/               # React context providers
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Library wrappers (Firebase, Stripe)
│   ├── pages/                  # Route-level page components
│   │   ├── marketing/          # Public marketing pages
│   │   └── guest/              # Guest/unauthenticated pages
│   ├── routes/                 # Route definitions
│   ├── services/               # API/service layer
│   ├── store/                  # State management
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Utility functions
├── functions/src/              # Firebase Cloud Functions (backend)
│   ├── billing/                # Stripe integration & webhooks
│   ├── inspections/            # Inspection business logic
│   ├── invites/                # Organization invite system
│   ├── lifecycle/              # Extinguisher lifecycle engine
│   ├── members/                # Membership management
│   ├── notifications/          # Alert & reminder system
│   ├── orgs/                   # Organization CRUD & management
│   ├── reports/                # Report generation
│   ├── tags/                   # Asset tag operations
│   ├── workspaces/             # Workspace management
│   ├── guest/                  # Guest access functions
│   ├── config/                 # Function configuration
│   ├── data/                   # Data utilities
│   ├── types/                  # Shared backend types
│   ├── utils/                  # Backend utilities
│   └── __tests__/              # Backend test suite
├── BUILD-SPECS/                # 25 specification documents (source of truth)
├── agents/                     # AI agent system (plan, build, review, document)
├── agent-system/               # Shared agent state files
├── firestore.rules             # Firestore security rules
├── storage.rules               # Cloud Storage security rules
├── firestore.indexes.json      # Firestore composite indexes
└── firebase.json               # Firebase project configuration
```

## Plans & Pricing

| Plan | Price | Extinguishers | Target Audience |
|------|-------|---------------|-----------------|
| **Basic** | $29.99/mo | 50 included (+$10/50 additional) | Small businesses, restaurants, retail stores |
| **Pro** | $99/mo | 250 included (+$10/100 additional) | Schools, small hospitals, property managers |
| **Elite** | $199/mo | 500 included (+$10/200 additional) | Large facilities, universities, industrial campuses |
| **Enterprise** | Custom | Unlimited | Custom compliance workflows, SLA support |

All plans include core inventory and inspection features. Higher tiers unlock barcode scanning, GPS capture, inspection photos, AI assistant, route optimization, advanced analytics, lifecycle compliance tracking, and priority support.

Contact: **info@extinguishertracker.com**

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) v10+
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- A Firebase project with Firestore, Auth, Storage, and Functions enabled
- A Stripe account with configured products and webhook endpoints

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd extinguisher-tracker-3

# Install frontend dependencies
pnpm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..
```

### Environment Variables

Create a `.env` file in the project root for frontend variables:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_xxx
```

Set Cloud Functions secrets via Firebase:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set STRIPE_PRICE_ID_BASIC
firebase functions:secrets:set STRIPE_PRICE_ID_PRO
firebase functions:secrets:set STRIPE_PRICE_ID_ELITE
```

### Development

```bash
# Start the Vite dev server
pnpm dev

# Start Firebase emulators (Auth, Firestore, Functions, Storage)
pnpm emulators

# Start emulators with persisted data
pnpm emulators:import

# Export emulator data for later use
pnpm emulators:export
```

### Build & Deploy

```bash
# Production build
pnpm build

# Deploy to Firebase dev preview channel (expires in 7 days)
pnpm deploy:dev

# Deploy to production
firebase deploy

# Deploy only Cloud Functions
cd functions && npm run build && cd .. && firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Storage rules
firebase deploy --only storage
```

### Testing

```bash
# Run frontend tests
pnpm test

# Run frontend tests in watch mode
pnpm test:watch

# Run backend tests
cd functions && npm test

# Lint
pnpm lint
```

## Architecture Principles

1. **Organization-centric data model** — All operational data lives under `org/{orgId}/...`. Never under `usr/{uid}`.
2. **Strict multi-tenant isolation** — Cross-org queries are forbidden. Every query is scoped to a single orgId.
3. **Org-specific roles** — Owner > Admin > Inspector > Viewer. Enforced at Firestore rules and Cloud Functions.
4. **Auth ≠ Authorization** — A valid auth session does not grant org data access. Membership and role must be verified.
5. **Stripe is billing source of truth** — Firestore caches billing state. The client never mutates billing directly.
6. **Privileged operations via Cloud Functions only** — Org creation, invites, role changes, billing, workspace archival, and report generation.
7. **Immutable compliance records** — Inspection events and audit logs are append-only once archived.
8. **Offline-first field design** — Inspectors work in low-connectivity areas. Local caching and queued writes are required.

## Firestore Data Model

```
org/{orgId}                           # Tenant root document
  ├── members/{uid}                   # Organization members & roles
  ├── locations/{locationId}          # Buildings, floors, sections
  ├── extinguishers/{extId}           # Extinguisher inventory
  ├── workspaces/{workspaceId}        # Monthly inspection workspaces
  ├── inspections/{inspectionId}      # Inspection records
  ├── inspectionEvents/{eventId}      # Immutable inspection events
  ├── reports/{reportId}              # Generated reports
  ├── auditLogs/{logId}              # Immutable audit trail
  ├── notifications/{notifId}         # User notifications
  ├── inspectionRoutes/{routeId}      # Pre-configured walking routes
  └── settings/{settingId}            # Org-level settings

usr/{uid}                             # User profile metadata only
invite/{inviteId}                     # Pending organization invitations
```

## Development Workflow

This project uses a branch-based workflow:

- **`dev`** — Active development and preview. Pushes deploy to the [Dev Preview Channel](https://extinguisher-tracker-3--dev-2zat4bfo.web.app).
- **`main`** — Production-ready code. Merges to main deploy to the [Production Site](https://extinguisher-tracker-3.web.app).

## Specification Documents

The `BUILD-SPECS/` directory contains 25 comprehensive specification documents that serve as the source of truth for all implementation:

| # | Document | Topic |
|---|----------|-------|
| 00 | AI Build Instructions | Master rules for AI-assisted implementation |
| 01 | Project Overview | Product vision, architecture, design philosophy |
| 02 | Auth, Orgs & Billing | Authentication, organizations, roles, Stripe |
| 03 | Database Schema | Complete Firestore schema and structural rules |
| 04 | Features Specification | Detailed product features and acceptance criteria |
| 05 | UI Components | Screens, layouts, and user-facing flows |
| 06 | Business Logic | Core business rules and compliance logic |
| 07 | API / Cloud Functions | Backend function specifications |
| 08 | Reports & Exports | Report generation and export formats |
| 09 | Plans & Pricing | Subscription tiers and feature gating |
| 10 | Multi-Tenant Isolation | Tenant separation rules |
| 11 | NFPA Compliance System | NFPA 10 compliance tracking rules |
| 12 | Extinguisher Lifecycle Engine | Lifecycle state machine and transitions |
| 13 | Asset Tagging | Barcode and QR code workflows |
| 14 | Audit Logging | Immutable audit trail specification |
| 15 | Location Hierarchy | Building/floor/section organization |
| 16 | Inspection Routes | Route planning and optimization |
| 17 | Offline Sync | Offline-first architecture and sync logic |
| 18 | Legal Attestation | Digital inspection sign-off |
| 19 | Placement Calculator | Extinguisher quantity/type calculations |
| 20 | Notifications System | Alerts, reminders, and notification delivery |
| 21 | Security Rules Architecture | Firestore and Storage security rules |
| 22 | Deployment & Environments | Deployment pipeline and environment config |
| 23 | Monitoring & Observability | Logging, metrics, and alerting |
| 24 | Data Retention & Backups | Backup strategy and data retention policies |

## Firebase Emulators

The project includes emulator configuration for local development:

| Service | Port |
|---------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Emulator UI | 4000 |

## License

**Proprietary** — Copyright (c) 2026 Beck-Publishing. All rights reserved. See [LICENSE](LICENSE) for details.

---

Created and maintained by **[Beck-Publishing](https://extinguishertracker.com)**
