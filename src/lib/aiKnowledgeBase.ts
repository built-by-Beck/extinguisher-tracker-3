/**
 * Internal Knowledge Base for the AI Assistant.
 * Provides the AI with information about how the Extinguisher Tracker program works
 * so it can help users with app navigation, operations, and troubleshooting.
 *
 * Author: built_by_Beck
 */

export const APP_KNOWLEDGE_BASE = `
### Extinguisher Tracker 3 — Full App Knowledge Base

Use this section to answer ANY question about how the app works, how to do something in
the app, where a feature lives, what a button does, or why something is / isn't visible.
This is authoritative — prefer it over general assumptions. If something isn't covered
here, give the user your best reasonable answer based on typical SaaS UI patterns and
point them to the most likely area of the app. Never reply with "I can't help with that".

---

**PLANS & FEATURE GATING**

Plans: Basic ($29.99/mo), Pro ($99/mo), Elite ($199/mo), Enterprise (custom).
Asset limits: Basic 50, Pro 250, Elite 500, Enterprise unlimited.

Feature availability by plan:
- Manual barcode entry: all plans
- Camera barcode scanning: Pro, Elite, Enterprise
- QR scanning: Pro, Elite, Enterprise
- GPS capture on inspections: Pro, Elite, Enterprise
- Photo upload on inspections: Pro, Elite, Enterprise
- Tag printing (single): Pro, Elite, Enterprise
- Bulk tag printing: Elite, Enterprise
- Inspection routes: Pro, Elite, Enterprise
- AI Assistant: Pro, Elite, Enterprise (Basic users do not see the assistant)
- Team members & invites: Elite, Enterprise
- Guest share-link access: Elite, Enterprise
- Compliance reports, reminders, section time tracking: all plans

If a user asks why a feature is missing, greyed out, or locked, first check their plan
(provided in the runtime context) against this list.

---

**ROLES & PERMISSIONS**

Roles: Owner > Admin > Inspector > Viewer (org-specific).
- Owner: everything, including billing, org deletion, transferring ownership.
- Admin: all operational features (members, audit logs, data organizer, workspace
  delete) except billing / ownership transfer.
- Inspector: inventory CRUD, perform inspections, create/archive workspaces, view reports.
- Viewer: read-only.

Routes only visible to Owner/Admin:
- Data Organizer (/dashboard/data-organizer)
- Audit Logs (/dashboard/audit-logs)
- Workspace delete button (on Inspections page)

If a user asks "why can't I see X", check their role first.

---

**TOP NAV / SIDEBAR**

The sidebar (desktop left, mobile hamburger) contains, in order:
Dashboard, Inspections, Inventory, Data Organizer (admin+), Locations, Members (Elite+),
Notifications, Sync Queue, Reports, Calculator, Audit Logs (admin+), Settings.

The floating red sparkle button (bottom-right) is the AI Assistant — that's me.

---

**DASHBOARD (/dashboard)**

Landing page after login. Shows:
- Top tiles: total extinguishers, compliance snapshot, overdue counts
- Quick Actions: Add Extinguisher, Create Workspace, Import, Scan
- Quick Lists: overdue inspections, upcoming expirations
- Optional ad banner (togglable in Settings) — if hidden, an AI prompt slot appears instead

To add an extinguisher fast: use the "Add Extinguisher" quick action.
To see what's due: check the Quick Lists section or the Expiration Planner tile.

---

**INVENTORY (/dashboard/inventory)**

The master list of every extinguisher in the org (soft-deleted items are hidden).

Key actions:
- **Add Extinguisher** (red button, top right) → opens /dashboard/inventory/new form.
- **Import** (Elite+): upload CSV / Excel / JSON, then map columns to system fields
  (ColumnMapperModal). Use the Import Guide page for format help.
- **Export**: download current inventory as CSV.
- **Columns** button: toggle visible table columns (Asset ID, Serial, Building, Vicinity,
  Section, compliance status, next inspection, etc.).
- **Filters**: filter by location, category, compliance status, lifecycle status.
- **Print List / Print Tags**: generates a printable view (Pro+ for single, Elite+ for bulk).
- Click any row to open Extinguisher Detail (/dashboard/inventory/:extId).
- Pencil icon → edit form (/dashboard/inventory/:extId/edit). Delete button lives
  at the bottom of the edit form (soft delete).

"Missing extinguishers after import" → check the "limit" was recently fixed (commit
fc6d0dc); if you're on old data, re-import or refresh.

---

**EXTINGUISHER DETAIL (/dashboard/inventory/:extId)**

Shows all metadata, inspection history (expandable), NFPA references, lifecycle status,
compliance status, and action buttons:
- **Edit Extinguisher** → edit form
- **Replace** → opens ReplaceExtinguisherModal. Replacement can reuse the same Asset ID
  (serial must still be unique). The old record is archived, not deleted.
- **Inspect Now** → one-click inspection workspace
- **Print Tag** (Pro+)
- **QR Code** button generates a printable QR that links to /qr/:orgId/:extId

---

**INSPECTIONS / WORKSPACES (/dashboard/workspaces)**

A "workspace" = a monthly snapshot of the inventory used to conduct inspections.

- **Create Workspace**: generates a new workspace for the current month with every active
  extinguisher pre-seeded as pending.
- Each workspace card shows progress (X of Y inspected) and status (Active / Archived).
- Click a workspace to open its detail view (/dashboard/workspaces/:workspaceId).
- Inside: browse by Location (Building → Floor → Room). Click a location to see its
  extinguisher table. Click any extinguisher to perform the inspection.
- Inspection flow: Pass/Fail buttons live ABOVE the checklist (recent UX change).
  Checklist follows NFPA 10 monthly inspection items. Photos (Pro+) and GPS (Pro+)
  optional. Section notes auto-save. Section timer tracks how long each area took.
- **Archive** a workspace when done → becomes read-only, generates final compliance
  report, inspectionEvents become immutable.
- **Delete** a workspace (Admin/Owner only, trash icon) → permanently deletes the
  workspace AND its inspection records. Orphaned inspections are cleaned up correctly
  (fixed in commit ad96da5).
- **Replace** button on inspection row: swap the physical asset mid-inspection.

Auto-created inspections: when a new extinguisher is added while a workspace is active,
it's automatically seeded as a pending inspection in that workspace.

---

**DATA ORGANIZER (/dashboard/data-organizer) — Admin/Owner only**

Power tool for cleaning up messy imports. Lists every active extinguisher missing
critical fields (location, serial, manufacture date, etc.) and lets you bulk-assign
values. Use this after a large import.

---

**LOCATIONS (/dashboard/locations)**

Strict hierarchy: Building → Floor → Room (or Building → Area → Section, etc.).

- Add top-level buildings with "Add Location".
- Click a building to drill down; add children with the "+" on each node.
- Assigning an extinguisher to a location automatically flows through to Dashboard
  tiles, workspace tables, and reports.
- Locations can be renamed, reordered, or deleted (deleting a location with
  extinguishers assigned is blocked — reassign first).
- FilterPanel on Inventory / Workspaces lets you filter by any level of the hierarchy.

---

**MEMBERS (/dashboard/members) — Elite+**

- **Invite Member** button: enter email + role, sends an email invite with a tokenized
  link to /invite/:token.
- Change role on existing members via the dropdown (Owner only for promoting to Owner).
- Revoke access: removes the membership. The user keeps their profile but loses org
  access immediately.

---

**NOTIFICATIONS (/dashboard/notifications)**

Feed of system notifications: upcoming inspections due, overdue items, workspace
archived, member invited, billing events. Bell icon in the topbar shows unread count.

---

**SYNC QUEUE (/dashboard/sync-queue)**

Shows offline writes that are pending upload. The app is offline-first for field
inspectors — actions taken while offline queue here and flush when back online.
If pendingCount > 0 and the user complains about missing data, point them here.

---

**REPORTS (/dashboard/reports)**

List of generated compliance reports (one per archived workspace, plus on-demand).
Click to download PDF. Reports are immutable once generated.

---

**AUDIT LOGS (/dashboard/audit-logs) — Admin/Owner only**

Append-only log of every sensitive action: member invites, role changes, workspace
archival/deletion, extinguisher replacement, billing events. Cannot be edited or deleted.

---

**CALCULATOR (/dashboard/calculator, also public at /calculator)**

NFPA 10 placement calculator. Enter square footage + hazard class → get required
extinguisher count, size, and max travel distance.

---

**SETTINGS (/dashboard/settings)**

Tabs: General (org name, logo), Billing (change plan, manage Stripe portal), Preferences
(hide ad banner, default filters), Notifications (email preferences).

To change plan: Settings → Billing tab → Manage Billing → Stripe portal.

---

**IMPORT GUIDE (/dashboard/import-guide)**

Simplified templates and column reference for CSV/Excel/JSON imports. Shows which fields
are required vs optional.

---

**PRINT TAGS / PRINTABLE LIST**

- Print Tags (/dashboard/inventory/print-tags): bulk-printable inspection tags with QR
  codes. Elite+ for bulk; Pro+ can print individual tags from Extinguisher Detail.
- Printable List (/dashboard/inventory/print): paper-friendly inventory list.

---

**GUEST ACCESS (Elite+)**

Owners can generate a share link (/guest/:orgId/:token) that lets outside users view
a read-only snapshot of inventory, locations, and workspaces. No login required. Guests
enter via /guest/code if they have a code instead of a link.

---

**QR LANDING (/qr/:orgId/:extId)**

Public page shown when someone scans an extinguisher's QR code. Shows basic info and
last inspection date. Used by inspectors and facility managers in the field.

---

**BARCODE / QR SCANNER (Pro+)**

Floating scanner accessible from multiple places (Dashboard, Inventory, workspace
inspection). Opens BarcodeScannerModal — requests camera permission, scans code,
auto-fills the target field. Manual entry mode available if camera fails.
Known issue: iPad may show a black screen after granting permission — workaround is
the manual entry button. iPhone works correctly.

---

**OFFLINE MODE**

All inspection and inventory writes work offline. They queue in the Sync Queue and
flush automatically when the connection returns. The sync indicator in the sidebar
shows pending count. Safe for inspectors in basements, mechanical rooms, warehouses.

---

**COMMON TROUBLESHOOTING**

- "I can't see the AI Assistant" → Basic plan doesn't include it. Upgrade to Pro+.
- "A menu item is missing" → Check role (Data Organizer / Audit Logs = Admin+) and
  plan (Members = Elite+).
- "My import lost extinguishers" → An old limit bug was fixed; re-import or refresh.
  Also check the Data Organizer for items missing required fields.
- "Workspace won't archive" → Make sure every extinguisher has been inspected (or
  marked N/A). Progress bar must be 100%.
- "Can't delete a location" → Reassign its extinguishers first.
- "Duplicate serial error on replace" → Serials must be globally unique per org.
  Asset IDs CAN be reused on replacement (recent change), serials cannot.
- "Inspection won't save" → Check Sync Queue; may be queued offline.
- "Camera black screen on iPad" → Known iPad Safari bug; use manual entry for now.
- "Billing info wrong" → Stripe is the source of truth. Settings → Billing → Manage
  Billing opens the Stripe customer portal.

---

**HOW TO READ THE RUNTIME CONTEXT**

You will receive a "Current organization data" block with the user's org name, plan,
role, current page URL, pending sync count, compliance summary, and a sample of their
inventory. USE THIS to personalize every answer:
- Refer to the user's current page when giving directions ("You're already on Inventory,
  just click the red 'Add Extinguisher' button top right").
- Reference their actual data ("You have 12 overdue monthly inspections — the top three
  by building are ...").
- Warn them if a feature they're asking about is gated behind a higher plan than theirs.
- Warn them if an action requires a role they don't have.
`;
