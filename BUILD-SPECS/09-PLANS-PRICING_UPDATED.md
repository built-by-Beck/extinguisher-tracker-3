# 09 --- Plans and Pricing

Pricing for Extinguisher Tracker 3 is **organization‑based SaaS
pricing**.

Organizations subscribe based on the number of extinguishers they manage
and the operational features required.

Reference source: turn2file1

------------------------------------------------------------------------

# Pricing Model

## Basic Plan

Price:

\$29.99 per month

Designed for:

-   small businesses
-   restaurants
-   retail stores
-   small facilities

Limit:

50 extinguishers included

Additional extinguishers:

+\$10 per month per 50 assets

Features:

-   manual inspections
-   monthly compliance reminders
-   inventory tracking
-   compliance reports
-   CSV / Excel / JSON export
-   manual barcode entry

Optional Add‑On:

Barcode scanning module

+\$25/month

------------------------------------------------------------------------

## Pro Plan

Price:

\$99 per month

Designed for:

-   medium facilities
-   property management companies
-   schools
-   small hospitals

Limit:

250 extinguishers included

Additional extinguishers:

+\$10 per month per 100 assets

Features:

-   camera barcode scanning
-   GPS capture
-   inspection photos
-   real‑time inspection updates
-   advanced reporting
-   section progress tracking
-   replacement tracking

------------------------------------------------------------------------

## Elite Plan

Price:

\$199 per month

Designed for:

-   large facilities
-   hospitals
-   universities
-   industrial campuses

Limit:

500 extinguishers included

Additional extinguishers:

+\$10 per month per 200 assets

Features:

-   all Pro features
-   route optimization
-   advanced analytics
-   priority support
-   multi‑facility reporting
-   lifecycle compliance tracking

------------------------------------------------------------------------

## Enterprise Plan

Unlimited extinguishers.

Custom pricing.

Includes:

-   unlimited assets
-   unlimited inspectors
-   advanced integrations
-   custom compliance workflows
-   SLA support

Contact:

help@beck-publishing.com

------------------------------------------------------------------------

# Feature Enforcement

Feature access must be enforced in:

-   UI components
-   Cloud Functions
-   Firestore security rules

Client‑side checks are **not sufficient**.

------------------------------------------------------------------------

# Plan Upgrade Rules

When upgrading:

-   features become immediately available
-   asset limits expand automatically

When downgrading:

-   system must prevent exceeding plan limits
-   existing data must remain intact

------------------------------------------------------------------------

# Billing Integration

Billing handled via **Stripe**.

Stripe controls:

-   subscription lifecycle
-   billing cycles
-   invoices
-   payment failures

Firestore stores **billing state cache only**.

------------------------------------------------------------------------

# Billing States

Possible states:

active\
trialing\
past_due\
unpaid\
canceled

Application features must respect billing state during:

-   writes
-   workspace creation
-   exports
