# EX3 Development Plan

**Current Phase**: 2 -- Core Operations & Billing
**Last Updated**: 2026-03-17
**Author**: built_by_Beck

---

## Phase 1 -- Foundation (COMPLETE)

All 28 tasks done: Firebase wiring, Auth, Org creation, Memberships, Firestore types, Security Rules, Storage Rules, Cloud Functions (createOrg, invites, member management), Dashboard shell, Protected routing.

---

## Phase 2 -- Core Operations & Billing

### Task Index

| ID | Title | Status | Dependencies |
|----|-------|--------|-------------|
| P2-01 | Install Stripe dependencies (frontend + backend) | Not Started | P1 |
| P2-02 | Stripe Cloud Functions: createCheckoutSession, createPortalSession | Not Started | P2-01 |
| P2-03 | Stripe webhook Cloud Function | Not Started | P2-01 |
| P2-04 | Plan feature flags helper + org billing fields | Not Started | P2-03 |
| P2-05 | Frontend Stripe integration (checkout + portal redirect) | Not Started | P2-02 |
| P2-06 | Billing UI: plan display, upgrade prompts, billing status | Not Started | P2-05, P2-04 |
| P2-07 | Org switching: multi-org context + switcher component | Not Started | P1 |
| P2-08 | Dashboard enhancements: stats cards, billing status | Not Started | P2-06, P2-07 |
| P2-09 | Extinguisher Firestore service layer (CRUD) | Not Started | P2-04 |
| P2-10 | Create Extinguisher page/form | Not Started | P2-09 |
| P2-11 | Extinguisher list page with filters/search | Not Started | P2-09 |
| P2-12 | Edit Extinguisher page | Not Started | P2-09, P2-10 |
| P2-13 | Soft-delete extinguisher + deleted view | Not Started | P2-09 |
| P2-14 | Asset limit enforcement (UI + backend) | Not Started | P2-04, P2-09 |
| P2-15 | Location hierarchy: Firestore service layer | Not Started | P1 |
| P2-16 | Location management page (tree view, CRUD) | Not Started | P2-15 |
| P2-17 | Location selector component (for extinguisher forms) | Not Started | P2-15, P2-16 |
| P2-18 | Link extinguishers to locations | Not Started | P2-09, P2-17 |
| P2-19 | Barcode/QR field assignments on extinguisher | Not Started | P2-09 |
| P2-20 | QR code generation Cloud Function | Not Started | P2-19 |
| P2-21 | Manual search by assetId/barcode/serial | Not Started | P2-09, P2-19 |
| P2-22 | CSV import Cloud Function | Not Started | P2-09 |
| P2-23 | CSV export Cloud Function | Not Started | P2-09 |
| P2-24 | Firestore indexes for Phase 2 collections | Not Started | P2-09, P2-15 |
| P2-25 | Security rules update for extinguishers + locations | Not Started | P2-09, P2-15 |
| P2-26 | Audit logging for Phase 2 operations | Not Started | P2-09 |
