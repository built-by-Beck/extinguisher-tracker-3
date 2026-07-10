# 09 — Plans and Pricing

Pricing for **Extinguisher Tracker 3** is **organization-based SaaS pricing**.

Organizations subscribe based on the number of extinguishers they manage
and the operational features required.

Reference source: turn2file1

---

## Pricing Model

### Basic Plan

Price:

$39.99 per month

Designed for:

- small businesses
- restaurants
- retail stores
- small facilities
- teams replacing paper logs with easier inspections and reminders

Limit:

50 extinguishers included

Additional extinguishers:

+$10 per month per 50 assets

Features:

- manual inspections
- monthly compliance reminders
- inventory tracking
- compliance reports
- CSV / Excel / JSON export
- manual barcode entry
- helps small teams stay on schedule and reduce paperwork

---

### Pro Plan

Price:

$129.99 per month

Designed for:

- medium facilities
- property management companies
- schools
- small hospitals

Limit:

250 extinguishers included

Additional extinguishers:

+$10 per month per 100 assets

Features:

- camera barcode scanning
- GPS capture
- inspection photos
- real-time inspection updates
- advanced reporting
- section progress tracking
- replacement tracking
- AI assistant

---

### Elite Plan

Price:

$229.99 per month

Designed for:

- large facilities
- hospitals
- universities
- industrial campuses

Limit:

500 extinguishers included

Additional extinguishers:

+$10 per month per 200 assets

Features:

- all Pro features, including the AI assistant
- route optimization
- advanced analytics
- priority support
- multi-facility reporting
- lifecycle compliance tracking

---

### Enterprise Plan

Unlimited extinguishers.

Custom pricing.

Includes:

- unlimited assets
- unlimited inspectors
- advanced integrations
- custom compliance workflows
- SLA support
- AI assistant

Contact:

info@extinguishertracker.com

---

## Feature Enforcement

Feature access must be enforced in:

- UI components
- Cloud Functions
- Firestore security rules

Client-side checks are **not sufficient**.

---

## Plan Upgrade Rules

When upgrading:

- features become immediately available
- asset limits expand automatically

When downgrading:

- system must prevent exceeding plan limits
- existing data must remain intact

---

## Billing Integration

Billing handled via **Stripe**.

Stripe controls:

- subscription lifecycle
- billing cycles
- invoices
- payment failures

Firestore stores **billing state cache only**.

---

## Free trial

- Organizations may be offered a **14-day** checkout trial. The checkout trial length is controlled by Functions env **`STRIPE_TRIAL_DAYS`** and defaults to **14**.
- Frontend trial copy is controlled by **`VITE_TRIAL_DAYS`** and should stay aligned with `STRIPE_TRIAL_DAYS`.
- Eligibility is enforced server-side in Cloud Functions (not the client): typically **one trial per organization**, tracked with **`trialUsedAt`** once the subscription enters **`trialing`**, and **no trial** when an organization already has an active Stripe subscription (for example upgrading from Basic).
- The Pro monthly trial funnel also tracks **`proTrialConsumed`** once a Pro subscription enters **`trialing`**.
- Follow-up: the legacy **`PRO_TRIAL_DAYS`** helper currently falls back to **7** if unset, while env examples set it to **14** for alignment. Reconcile that backend helper before removing the explicit env value.

---

## Billing States

Possible states:

- `active`
- `trialing`
- `past_due`
- `unpaid`
- `canceled`

Application features must respect billing state during:

- writes
- workspace creation
- exports
