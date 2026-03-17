# 17 --- Offline Sync System

Inspectors often perform inspections in environments where network
connectivity is unreliable.

Examples include:

-   stairwells
-   mechanical rooms
-   basements
-   parking garages
-   utility areas

The platform must support **offline inspection workflows** so inspectors
can continue working even when disconnected.

Reference source: turn4file2

------------------------------------------------------------------------

# Offline Capability Requirements

The application must support:

-   local data caching
-   offline inspection recording
-   queued writes
-   conflict detection
-   automatic synchronization when connectivity returns

------------------------------------------------------------------------

# Local Data Storage

When offline mode is active, the application should store data locally
using:

-   IndexedDB
-   local browser storage
-   or mobile device storage

Cached data may include:

-   extinguisher inventory
-   active workspace
-   inspection routes
-   location hierarchy

------------------------------------------------------------------------

# Queued Inspection Writes

When offline:

-   inspections are stored locally
-   each inspection is queued for upload
-   the queue persists across app restarts

Example queue item:

    inspectionId
    extinguisherId
    status
    checklistData
    timestamp
    photoPath

------------------------------------------------------------------------

# Sync Behavior

When connectivity returns:

1.  queued inspection records are uploaded
2.  Firestore updates inspection records
3.  inspection events are generated
4.  workspace statistics update

------------------------------------------------------------------------

# Conflict Resolution

Conflicts may occur if:

-   two inspectors edit the same record
-   an extinguisher is replaced during inspection
-   a workspace is archived during offline work

Resolution rules:

-   most recent valid inspection wins
-   conflicting changes logged in audit logs
-   administrators may manually review conflicts

------------------------------------------------------------------------

# Offline Safety Rules

The offline system must ensure:

-   organization context remains correct
-   cached data does not mix organizations
-   inspection history remains consistent
-   archived workspaces cannot be modified
