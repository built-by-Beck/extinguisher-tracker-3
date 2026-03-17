# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Extinguisher Tracker 3 (EX3)** — a multi-tenant SaaS fire extinguisher inspection, compliance, and lifecycle management platform. Designed for hospitals, schools, warehouses, manufacturing facilities, and property management companies to stay NFPA 10 compliant.

**Author**: built_by_Beck (sole developer, founder, CEO). All commits must include "built_by_Beck" in the message.

## Status

This project is in the **pre-build/specification phase**. The `BUILD-SPECS/` folder contains 25 comprehensive specification documents (00–24) that are the **source of truth** for all implementation. No application code exists yet.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Router
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, Storage)
- **Billing**: Stripe (webhook-driven, source of truth for subscriptions)
- **Deployment**: Firebase Hosting + Cloud Functions

## Build Commands

No build system is set up yet. When initialized, expect:
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `cd functions && npm run build` — Cloud Functions build
- `firebase emulators:start` — local Firebase emulators
- `firebase deploy` — deploy to Firebase

## Specification Documents

All specs live in `BUILD-SPECS/`. Key files by topic:

| File | Topic |
|------|-------|
| `00-AI-BUILD-INSTRUCTIONS.md` | **Read first.** Master rules for AI implementation |
| `01-PROJECT-OVERVIEW.md` | Product vision, architecture principles |
| `02-*` | Auth, organizations, roles, Stripe billing |
| `03-*` | Firestore schema (all collections) |
| `04-*` | Feature specs and workflows |
| `06-*` | Business logic, compliance rules, lifecycle |
| `07-*` | Cloud Functions and security rules |
| `09-*` | Plans & pricing (Basic $29.99, Pro $99, Elite $199, Enterprise custom) |
| `10-*` | Multi-tenant isolation rules |
| `11-*` | NFPA compliance system |
| `12-*` | Extinguisher lifecycle engine |
| `17-*` | Offline sync |
| `21-*` | Security rules architecture |

## Architecture (Non-Negotiable Rules)

1. **Organization-centric data model**: ALL operational data under `org/{orgId}/...`. Never under `usr/{uid}`.
2. **Strict multi-tenant isolation**: Cross-org queries are forbidden. Every query scoped to one orgId.
3. **Roles are org-specific**: Owner > Admin > Inspector > Viewer. Enforced at Firestore rules + Cloud Functions.
4. **Auth ≠ Authorization**: Valid auth session does NOT grant org data access. Must verify membership + role.
5. **Stripe is billing source of truth**: Firestore caches billing state. Client never mutates billing directly.
6. **Privileged ops via Cloud Functions only**: org creation, invites, role changes, billing, workspace archival, report generation.
7. **Compliance records are immutable once archived**: inspectionEvents and auditLogs are append-only.
8. **Offline-first field design**: Inspectors work in low-connectivity areas. Local caching + queued writes required.

## Firestore Top-Level Collections

```
org/{orgId}           — tenant root (subcollections: members, locations, extinguishers, workspaces, inspections, inspectionEvents, reports, auditLogs, notifications, inspectionRoutes, settings)
usr/{uid}             — user profile metadata ONLY
invite/{inviteId}     — pending org invitations
```

## Agent System

Three collaborative agents in `agents/.claude/agents/`:

- **plan-agent** (Opus) — reads project state, produces decomposed tasks in `agent-system/plan.md`
- **build-agent** (Sonnet) — implements tasks from the plan, updates `agent-system/agents-info.md`
- **review-agent** (Opus) — reviews completed work, fixes issues, updates `agent-system/lessons-learned.md`

Shared state files live in `agent-system/` (plan.md, agents-info.md, lessons-learned.md).

## Suggested Project Structure (from specs)

```
src/
  app/ components/ pages/ hooks/ lib/ features/
  contexts/ routes/ types/ utils/ services/ store/

functions/src/
  index.ts auth/ orgs/ members/ invites/ billing/
  workspaces/ inspections/ reports/ notifications/
  lifecycle/ tags/ utils/
```

## Required Build Order

Firebase wiring → Auth → Org creation → Memberships → Firestore schema/types → Security Rules → Storage Rules → Stripe/Pricing → Org switching → Dashboard → Inventory → Locations → Asset tagging → Workspaces → Inspections → Reminders → Compliance engine → Lifecycle engine → Reports → Audit logs → Offline sync → Legal attestation → Security hardening

## Key Environment Variables

Frontend (`VITE_` prefix): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_STRIPE_PUBLISHABLE_KEY`

Backend: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_ELITE`
