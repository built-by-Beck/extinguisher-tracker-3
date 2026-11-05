# Roadmap

Extinguisher Tracker 3 is live in production. This is the work still ahead, grouped by priority. Each item points at the spec in `BUILD-SPECS/` or the notes it came from.

Status key: 🔨 in progress · 📋 planned · 💡 exploring

## Now

- 🔨 **Cost guard deploy.** The $30/month budget throttle is built on `feature/cost-guard-budget-throttle`. It still needs a deploy and a Cloud Billing budget wired to the `billing-budget-alerts` Pub/Sub topic.
- 📋 **App Check on callable functions.** Callables currently run with `enforceAppCheck: false`. Turn on App Check (reCAPTCHA Enterprise) in the web app, then enforce it per function.
- 📋 **Scheduled Firestore backups** (spec 24). Daily exports to Cloud Storage, a retention policy, and a written restore runbook for a full restore and a single-org restore.
- 📋 **Error monitoring and alerting** (spec 23). Frontend error reporting (Sentry or similar), plus alerts for Cloud Function failures and Stripe webhook errors.
- 📋 **Stripe go-live checks.** Confirm the live yearly price IDs and the live webhook event list in production.

## Next

- 📋 **Email notifications** (spec 20). Send invite emails, so admins no longer share invite links by hand, and inspection-due and overdue reminder emails.
- 📋 **Inspection Routes UI** (spec 16). The data model and plan gating already exist. Still to build: create and edit routes, assign them to inspectors, walk a route in order, and track route progress.
- 📋 **Pro/Elite notification controls** (spec 20). Custom reminder schedules, escalations, per-extinguisher alerts, and alerts sent to several users.
- 📋 **Guest workspace redesign.** Bring `GuestWorkspaceDetail` up to the same compact master-detail layout as the signed-in workspace view.
- 📋 **Floor cleanup follow-through.** After "Normalize floors" merges locations, repair `inspection.locationId` on existing inspections, and add a bulk `locationId` migration tool.
- 📋 **CSV import location warnings.** Flag each row whose `locationName` doesn't match a location, instead of quietly importing it as Unassigned.
- 📋 **Server-side inventory PDF.** Generate the inventory PDF on the backend so large orgs get a reliable export.

## Later

- 📋 **Installable PWA.** Add a service worker so the app shell loads offline, building on the existing IndexedDB write queue (spec 17).
- 📋 **Push notifications** (spec 20).
- 📋 **Multi-inspector presence.** Show who is working in a workspace or section right now.
- 📋 **In-app field work documents.** Fill in pass/fail on work-document templates in the app; today they are printable only.
- 📋 **Performance.** More route-level code splitting to shrink the main bundle (the chunk size warning is currently raised to 1000 kB).
- 💡 **Route optimization** (spec 16). Shortest walking path, GPS-assisted routing, indoor maps.
- 💡 **NFPA edition rules matrix.** Edition-specific inspection intervals, gated behind a verified rules table and a legal review.
- 💡 **Enterprise integrations** (spec 20). Connectors to external safety and facilities platforms.

## Quality and tests

- 📋 Integration test for the path where an expired pending invite unblocks a new invite.
- 📋 Tests for the "generate from locations" fallback when a root has no stairwells.
- 📋 Wider test coverage for the replacement workflow and the workspace stats recalculation (`recalculateWorkspaceInspectionStats`).

## Docs

- 📋 FAQ and Getting Started updates for custom assets and email invites (once email invites ship).
- 📋 A public changelog for releases.
