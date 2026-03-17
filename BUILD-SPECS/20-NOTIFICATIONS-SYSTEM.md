# 20 --- Notifications System

The Notifications System provides automated reminders and alerts related
to compliance events.

## Purpose

Help organizations remain compliant by reminding users when:

-   monthly inspections are due
-   annual inspections are approaching
-   6‑year maintenance is approaching
-   hydrostatic tests are approaching
-   extinguishers become overdue
-   inspections fail

## Firestore Structure

org/{orgId}/notifications/{notificationId}

Fields:

type\
message\
severity\
targetUserIds\[\]\
createdAt\
readAt\
status

## Notification Types

inspection_due\
inspection_overdue\
annual_due\
maintenance_due\
hydro_due\
system_alert

## Delivery Channels

-   in‑app notifications
-   email notifications (future)
-   push notifications (future)

## Plan Rules

Basic plan supports standard reminders.

Pro and Elite plans may support:

-   custom notification schedules
-   escalations
-   multi‑user alerts

Enterprise may support integration with external safety platforms.
