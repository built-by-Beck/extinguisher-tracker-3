# 14 --- Audit Logging System

The audit logging system records critical platform actions to preserve
operational transparency and regulatory accountability.

Reference source: turn3file3

------------------------------------------------------------------------

# Purpose

Audit logs provide:

-   security visibility
-   operational traceability
-   compliance history
-   forensic investigation capability

They are essential for compliance‑oriented SaaS platforms.

------------------------------------------------------------------------

# Audit Log Storage

Logs stored in:

    org/{orgId}/auditLogs/{logId}

Logs are **organization‑scoped**.

------------------------------------------------------------------------

# Core Log Fields

    eventType
    userId
    timestamp
    entityType
    entityId
    changes

Optional fields:

-   userEmail
-   device
-   ipAddress
-   previousState
-   newState

------------------------------------------------------------------------

# Example Event Types

Inspection events:

-   inspection.completed
-   inspection.updated
-   inspection.reset

Asset events:

-   extinguisher.created
-   extinguisher.updated
-   extinguisher.deleted
-   extinguisher.replaced

User events:

-   user.invited
-   user.joined
-   user.removed
-   role.changed

Tag events:

-   tag.generated
-   tag.printed

System events:

-   workspace.archived
-   report.generated
-   data.exported

------------------------------------------------------------------------

# Log Integrity Rules

Audit logs must be:

-   append‑only
-   immutable once written
-   organization‑scoped
-   accessible only to authorized roles

Roles allowed to view logs:

-   owner
-   admin

Inspectors may receive limited visibility if configured.

------------------------------------------------------------------------

# Log Retention

Audit logs should be retained for long‑term compliance records.

Recommended retention:

-   minimum 7 years
