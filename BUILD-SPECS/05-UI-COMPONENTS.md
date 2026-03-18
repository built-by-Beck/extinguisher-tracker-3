# 05 — UI Components

This document defines the major pages, layouts, screens, components, overlays, interaction patterns, and UI behavior for Extinguisher Tracker 3 (EX3).

The UI is mobile-first because the primary use case is inspectors and maintenance staff working in the field on phones and tablets. However, the platform must also work well on desktop for administrators, safety managers, and billing users.

All interactive elements must be touch-friendly, with a minimum target size of approximately 44px where practical.

The UI must feel like:

- modern B2B software
- easy to use in the field
- reliable under time pressure
- clear for compliance-driven tasks
- professional enough for companies paying for serious operational value

## UI Design Principles

The interface must follow these principles:

### 1. Mobile-First but Not Mobile-Only

The app must work great on:

- phones
- tablets
- desktop/laptop browsers

### 2. Speed Over Decoration

Field users must be able to:

- search quickly
- scan quickly
- inspect quickly
- move between records quickly

### 3. Compliance Visibility

Users should always be able to see:

- what is due
- what is overdue
- what is complete
- what plan/features they have access to

### 4. Role-Aware Interface

Owners, admins, inspectors, and viewers should see different controls based on permissions.

### 5. Plan-Aware Interface

**Basic**, **Pro**, **Elite**, and **Enterprise** plans may expose different UI controls depending on feature access.

### 6. Clear State and Feedback

Every important action must have visible feedback:

- loading
- success
- warning
- failure
- disabled state
- confirmation state

## Application Areas

The product has two major UI areas:

- **Marketing Site** — public pages accessible without authentication
- **Application** — authenticated multi-tenant SPA behind login

## Marketing Site

The marketing site is public-facing and designed to convert visitors into signups or sales conversations.

It should communicate:

- what the product does
- why it matters
- who it is for
- pricing
- trust and credibility
- how to get started

### Marketing Site Pages

#### Landing Page

##### Purpose

Convert visitors into signups or sales leads.

##### Core Sections

- hero section with headline and CTA
- trust/value proposition section
- major feature highlights
- compliance-focused messaging
- "how it works" section
- pricing summary
- CTA to sign up or contact sales

##### Key Messaging

The landing page should position the product as:

- compliance software
- inspection software
- lifecycle tracking software
- modern field inspection platform

##### Suggested Hero Themes

- stay compliant
- simplify extinguisher inspections
- be audit-ready
- manage inspections across teams and facilities

#### Features Page

##### Purpose

Give evaluators a clear overview of product capabilities.

##### Content

- inventory management
- monthly inspections
- reminders
- compliance tracking
- lifecycle engine
- QR/barcode tagging
- route inspections
- reporting
- audit logs
- offline capability

##### Acceptance Criteria

- features are organized by category
- the page clearly distinguishes the product from paper/manual tracking
- high-value B2B features are emphasized

#### Pricing Page

##### Purpose

Display plans and encourage signups.

##### Required Plans

- **Basic**
- **Pro**
- **Elite**
- **Enterprise**

##### Required Pricing Display

**Basic**

- $29.99/month
- 50 extinguishers included
- +$10/month per additional 50 extinguishers

**Pro**

- $99/month
- 250 extinguishers included
- +$10/month per additional 50 extinguishers

**Elite**

- $199/month
- 500 extinguishers included
- +$10/month per additional 50 extinguishers

**Enterprise**

- Contact Sales
- help@beck-publishing.com

##### Pricing Page Requirements

- clearly list included features
- clearly show feature differences
- mark **Pro** as the recommended / most popular plan
- show **Enterprise** as contact-sales
- show **Basic** includes reminders but not camera scanning
- make it obvious that **Pro** unlocks scanning / GPS / routes / tagging

##### CTA Buttons

- **Basic** → Start Basic
- **Pro** → Start Pro
- **Elite** → Start Elite
- **Enterprise** → Contact Sales

#### About Page

##### Purpose

Explain product mission and background.

##### Suggested Content

- creator/founder background
- mission statement
- why the software exists
- contact information

#### Terms of Service Page

Standard legal page.

#### Privacy Policy Page

Standard privacy page.

## Authenticated Application

The authenticated application is the operational core of EX3.

It is an SPA that loads organization-scoped data after auth and membership checks.

## Application Shell

The application shell wraps all authenticated pages.

### Shell Structure

```
+--------------------------------------------------+
| Top Header / App Bar                             |
+--------------------------------------------------+
| Optional Notification / Billing Banner Area      |
+--------------------------------------------------+
| Main Content Area                                |
|                                                  |
|                                                  |
+--------------------------------------------------+
| Optional Mobile Action Footer / Quick Actions    |
+--------------------------------------------------+
```

### Behavior

- top header stays visible
- main content area scrolls
- no permanently visible desktop-only sidebar is required for v1
- contextual menus and panels provide deeper navigation
- shell must work cleanly on phones and tablets

## Global Header / App Bar

The header is always visible inside the application.

**Required Content**

- active organization name
- organization switcher (if user belongs to multiple orgs)
- active workspace badge
- user menu / account entry
- menu toggle button
- optional quick action buttons
- notification icon / badge
- billing warning indicator when needed

### Workspace Badge

The workspace badge shows current month/workspace.

Examples:

- Mar 2026
- Apr 2026
- Archived: Feb 2026

Tapping or long-pressing the badge may open workspace switcher.

### Organization Switcher

Visible when the user belongs to more than one organization.

Shows:

- current org name
- dropdown / modal list of accessible orgs

### Notification Icon

Shows unread count where supported.

Tapping opens notification panel or notification page.

### User Menu

Contains:

- user email / display name
- profile/account actions
- logout
- maybe org switch on smaller screens

### Banner / Alert Area

A sticky or dismissible banner area may appear below the header.

#### Possible banners

- past due billing notice
- canceled subscription warning
- over-limit warning
- monthly inspection reminder
- annual service due reminder
- workspace archived notice
- offline mode banner

#### Acceptance Criteria

- banners are obvious but not overwhelming
- urgent actions are visually distinct
- banners link to the relevant workflow

## Main Navigation Model

The application should support lightweight navigation with contextual menus and page-level actions.

Primary navigation destinations may include:

- Dashboard
- Inventory
- Workspaces
- Reports
- Settings
- Notifications

Additional tools may include:

- Routes
- Locations
- Tag Printing
- Imports / Exports
- Placement Calculator
- Billing

## Core Application Pages

### Dashboard Page

#### Route

`/app` or `/app/dashboard`

#### Purpose

Primary landing page after login.

This page should give users immediate visibility into:

- inspection progress
- what is due
- what is overdue
- what needs attention
- fast next actions

#### Dashboard Layout

```
+--------------------------------------------------+
| Header / Org Switcher / Workspace Badge          |
+--------------------------------------------------+
| Alert Banners / Notifications                    |
+--------------------------------------------------+
| Compliance Summary Cards                         |
| [Pending] [Passed] [Failed] [Overdue]            |
+--------------------------------------------------+
| Quick Actions                                    |
| [Manual Search] [Scan] [New Workspace] [Reports] |
+--------------------------------------------------+
| Compliance Widgets                               |
| - Monthly Due                                    |
| - Annual Due                                     |
| - 6-Year Due                                     |
| - Hydro Due                                      |
+--------------------------------------------------+
| Section / Route / Inventory Progress Areas       |
+--------------------------------------------------+
```

#### Recommended Dashboard Sections

##### 1. Quick Actions

Examples:

- Manual Search
- Camera Scan
- Create Workspace
- Open Reports
- Add Extinguisher
- Run Placement Calculator

##### 2. Compliance Summary Cards

Examples:

- Pending This Month
- Passed
- Failed
- Overdue
- Annual Due
- Hydro Due

Each card should be clickable and open filtered views.

##### 3. Notifications / Reminders

Show latest reminders such as:

- monthly inspections due in 3 days
- annual inspections due
- workspace not yet created
- org is over limit
- billing needs attention

##### 4. Section / Route Progress

Show:

- section cards
- route cards
- completion percentages
- pending counts

##### 5. Plan / Usage Widget

Shows:

- current plan
- included extinguisher count
- current active count
- over-limit state if applicable

#### Acceptance Criteria

- dashboard loads quickly
- cards are clearly tappable
- metrics update dynamically
- reminders and warnings are obvious
- role and plan restrictions are respected

### Inventory Page

#### Route

`/app/inventory`

#### Purpose

Primary inventory management screen for extinguisher records.

**Main Layout**

```
+--------------------------------------------------+
| Inventory Header                                 |
| [Search] [Filters] [Sort] [Add]                  |
+--------------------------------------------------+
| Quick Filters                                    |
| [All] [Pending] [Failed] [Overdue] [Spare]       |
+--------------------------------------------------+
| List / Cards of Extinguishers                    |
|                                                  |
+--------------------------------------------------+
```

#### Inventory Page Features

- search
- section filter
- location filter
- compliance filter
- route filter
- status filter
- sort options
- add extinguisher button (role-aware)
- bulk actions (future-ready)

#### Inventory Item Display

Each extinguisher item may show:

- asset ID
- section / location
- barcode/QR indicator
- compliance status
- current monthly inspection state
- quick pass/fail buttons where allowed
- tag printed indicator
- overdue badges

#### Acceptance Criteria

- list is fast and readable on mobile
- filters combine correctly
- inventory remains org-scoped
- plan-aware actions are hidden/disabled appropriately

### Extinguisher Detail / Inspection View

#### Route

`/app/extinguishers/{extId}`

May open as:

- full page
- slide-over panel
- modal-like mobile page

#### Purpose

Single source of truth view for one extinguisher.

This page combines:

- identity
- location
- lifecycle
- inspection workflow
- compliance visibility
- history

#### Major Sections

##### 1. Header

- back button
- asset ID
- status badge
- compliance badge

##### 2. Identity and Classification

- asset ID
- barcode
- QR info
- serial
- manufacturer
- type
- service class
- size
- category

##### 3. Location

- section
- vicinity
- parent location
- location hierarchy reference
- map link if GPS exists

##### 4. Photos

- thumbnails
- add photo if permitted
- reorder/delete where permitted

##### 5. Lifecycle / Compliance Summary

- last monthly inspection
- next monthly inspection
- annual due
- six-year due
- hydro due
- lifecycle status
- overdue flags

##### 6. Inspection Checklist

- 13 checklist items
- pass/fail/n-a controls

##### 7. Inspection Capture

- notes
- inspection photo
- inspection GPS
- attestation section
- PASS / FAIL / RESET buttons

##### 8. History

- inspection history
- inspection event timeline
- replacement history
- audit/log references if shown

##### 9. Management Actions

Visible for appropriate roles:

- edit
- replace
- print tag
- delete
- regenerate QR
- capture asset GPS

#### Acceptance Criteria

- page is scrollable and mobile-friendly
- all major extinguisher state is visible in one place
- inspection workflow is fast to complete
- lifecycle information is obvious
- legal attestation is captured when required
- archived workspace state disables edits appropriately

### Workspaces Page

#### Route

`/app/workspaces`

#### Purpose

Manage and switch monthly inspection workspaces.

#### Page Content

- current active workspace
- archived workspaces
- create workspace action
- archive workspace action
- workspace stats
- workspace status badges

#### Acceptance Criteria

- users can clearly tell active vs archived
- archived workspaces are read-only
- create/archive actions are permission-aware
- switching workspace updates global app context

### Routes Page

#### Route

`/app/routes`

#### Purpose

Manage inspection routes and perform route-based inspection workflows.

#### Page Sections

- route list
- create/edit route
- route detail
- route progress
- start route inspection

#### Acceptance Criteria

- routes visible only where plan/role allow
- inspectors can work through route order
- route progress persists
- route completion percentage is shown

### Reports Page

#### Route

`/app/reports`

#### Purpose

Generate, view, and download reports and exports.

#### Page Features

- archived monthly reports
- export buttons
- report filters
- format selectors
- compliance summaries
- downloadable files

#### Typical Actions

- export CSV
- export Excel
- export JSON
- download PDF if implemented
- open archived report snapshot

#### Acceptance Criteria

- reports are clearly scoped to current org/workspace
- report actions are permission-checked
- plan-aware exports are enforced
- archived reports are visibly read-only

### Notifications Page / Panel

#### Route

`/app/notifications` or slide-out panel

#### Purpose

Show reminders, alerts, and action-needed events.

#### Notification Types

- monthly reminder
- annual due
- hydro due
- six-year due
- over-limit
- billing notice
- workspace reminder
- system notification

#### Acceptance Criteria

- unread count is visible
- notifications can be marked read where supported
- each notification links to useful target
- notification content is org-scoped

### Settings Page

#### Route

`/app/settings`

#### Purpose

Manage organization configuration, team settings, and account options.

#### Sections

##### Organization Info

- name
- timezone
- slug if editable

##### Sections

- add
- rename
- reorder
- remove

##### Locations

- location hierarchy management

##### Team Members

- member list
- role management
- pending invites
- revoke invite
- remove member

##### Billing

- current plan
- status
- included limit
- over-limit state
- Manage Billing button

##### Notifications / Preferences

- reminder visibility
- future email preferences if implemented

##### Danger Zone

- org deletion workflow
- only for owner

#### Acceptance Criteria

- settings are grouped clearly
- dangerous actions are separated visually
- billing area is owner-only
- team management is admin/owner-only

## Public / Auth Utility Pages

### Login Page

- email/password form
- login CTA
- link to signup
- forgot password if added later

### Signup Page

- account creation form
- org creation handoff
- marketing reassurance

### Invite Acceptance Page

- invite summary
- login/signup path
- accept invite action
- error states for expired/revoked invite

### Plan Selection / Checkout Redirect Page

- select plan
- show plan comparison
- start checkout

## Modals and Overlays

All modal-like experiences should work well on mobile.

On phones:

- prefer full-screen sheets or near-full-screen overlays

On desktop:

- centered modals with backdrop are fine

All modals must have:

- close button
- keyboard escape support where applicable
- focus management
- accessible headings and labels

**Required Modals / Panels**

### Camera Scanner Modal

#### Purpose

Live barcode / QR scanning.

#### Content

- live camera preview
- scan guides / overlay
- flash toggle if available
- cancel
- manual fallback

#### Plan-aware

Not available on **Basic**.

### Manual Search Modal

#### Purpose

Enter barcode / asset ID manually.

#### Content

- focused input
- search action
- clear/cancel

Available on all plans.

### Add Extinguisher Modal

#### Purpose

Create extinguisher record.

#### Content

- required identity fields
- optional location fields
- type / size fields
- lifecycle seed fields
- GPS / photo actions if allowed
- save/cancel

Plan- and role-aware.

### Edit Extinguisher Modal

#### Purpose

Edit existing extinguisher.

#### Content

- prefilled fields
- lifecycle fields
- tagging fields
- photo management
- save/delete actions

### Replace Extinguisher Modal

#### Purpose

Record replacement while preserving history.

#### Content

- old identity summary
- new asset fields
- reason
- notes
- save/cancel

### Workspace Switcher Modal

#### Purpose

Switch active workspace.

#### Content

- workspace list
- active/archive badges
- progress stats

### Create Workspace Modal

#### Purpose

Create new monthly workspace.

#### Content

- month/year selector
- explanation of what creation does
- create/cancel

### Export Options Modal

#### Purpose

Choose export options.

#### Content

- format selector
- filters
- include/exclude options
- export/cancel

### Section Notes Modal

#### Purpose

Edit section notes.

#### Content

- section selector if needed
- notes area
- save-for-next-month toggle
- metadata display

### Import Data Modal

#### Purpose

Upload CSV/Excel/JSON depending on workflow.

#### Content

- file upload
- default section/location controls
- import button
- validation summary

### Invite Member Modal

#### Purpose

Invite org member.

#### Content

- email
- role selector
- send invite
- pending invite list
- revoke action

### Confirm Modal

#### Purpose

Replace browser confirm dialogs.

Must be used for:

- delete extinguisher
- archive workspace
- reset workspace
- remove member
- dangerous actions

### Notification Drawer / Sheet

#### Purpose

Quick access to reminders and alerts.

#### Content

- unread items
- timestamp
- type
- deep link target

## Component Hierarchy

A suggested component hierarchy:

```
App
├── PublicSite
│   ├── LandingPage
│   ├── FeaturesPage
│   ├── PricingPage
│   ├── AboutPage
│   ├── TermsPage
│   └── PrivacyPage
├── AuthPages
│   ├── LoginPage
│   ├── SignupPage
│   ├── InvitePage
│   └── PlanSelectionPage
└── ApplicationShell
    ├── HeaderBar
    │   ├── OrgSwitcher
    │   ├── WorkspaceBadge
    │   ├── NotificationButton
    │   └── UserMenu
    ├── AlertBannerArea
    ├── DashboardPage
    │   ├── QuickActions
    │   ├── SummaryCards
    │   ├── NotificationList
    │   ├── SectionCards
    │   └── RouteCards
    ├── InventoryPage
    │   ├── FiltersBar
    │   ├── SearchBar
    │   ├── SortControls
    │   └── ExtinguisherList
    ├── ExtinguisherDetailPage
    │   ├── IdentitySection
    │   ├── LocationSection
    │   ├── LifecycleSection
    │   ├── PhotoSection
    │   ├── ChecklistSection
    │   ├── CaptureSection
    │   ├── HistorySection
    │   └── ManagementSection
    ├── WorkspacesPage
    ├── RoutesPage
    ├── ReportsPage
    ├── NotificationsPage
    ├── SettingsPage
    └── Modals / Drawers
```

## UI Patterns

### Loading States

Use:

- full-page loading for initial app boot
- section-level skeletons or spinners
- button-level loading states for saves/actions

### Empty States

Examples:

- "No extinguishers found. Add one or import inventory."
- "No workspace exists for this month yet."
- "No notifications right now."
- "No routes created yet."

### Error States

Use:

- toast notifications for transient failures
- inline form errors for validation
- full-page error state for major failures
- retry affordances where practical

## Responsive Behavior

### Mobile

- single-column layout
- full-width actions
- full-screen modals

### Tablet

- wider cards
- 2-column sections where useful
- centered overlays

### Desktop

- wider content areas
- multi-column summary layouts
- still maintain mobile-friendly interactions

## Color Coding

- pending → neutral
- pass → green
- fail → red
- warning → amber/yellow
- info → blue
- overdue → red/emphasis
- archived → subdued/locked appearance

**Color must never be the only state indicator.**

## Accessibility

- ARIA labels where needed
- visible labels for form inputs
- proper focus handling in modals
- good text contrast
- keyboard accessibility where appropriate
- icons paired with text or labels
- large touch targets for field users

## Final UI Rule

The UI must always reflect:

- current organization
- current workspace
- current plan
- current role
- current compliance state

At no point should the interface make a user guess:

- what org they are in
- what month they are inspecting
- whether something is due
- whether something is locked
- whether a feature is unavailable because of role or plan

The UI must feel clear, trustworthy, and fast enough for real field use.
