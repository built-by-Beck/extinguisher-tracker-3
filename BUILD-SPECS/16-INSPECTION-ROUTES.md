# 16 --- Inspection Routes

Inspection routes define optimized walking paths for inspectors
performing monthly extinguisher inspections.

Routes help organizations improve inspection efficiency by grouping
extinguishers into logical walking sequences.

Reference source: turn4file1

------------------------------------------------------------------------

# Purpose of Routes

Without routes, inspectors must manually search for each extinguisher.

Routes provide:

-   predefined inspection paths
-   grouped extinguisher lists
-   efficient walking sequences
-   predictable inspection workflows

Routes are particularly valuable in:

-   hospitals
-   campuses
-   warehouses
-   multi‑building facilities

------------------------------------------------------------------------

# Firestore Structure

Routes are stored under the organization.

    org/{orgId}/inspectionRoutes/{routeId}

Example fields:

    name
    description
    extinguisherIds[]
    order[]
    createdBy
    createdAt
    updatedAt

------------------------------------------------------------------------

# Route Design

Routes may be designed in several ways:

### Location-Based Routes

Routes follow location hierarchy.

Example:

Building A → Floor 1 → Floor 2 → Floor 3

### Maintenance Zones

Facilities may divide inspection areas into zones.

Example:

North Wing Route\
South Wing Route\
Mechanical Rooms Route

### Inspector Assignment Routes

Routes may be assigned to specific inspectors.

Example:

Route A → Inspector 1\
Route B → Inspector 2

------------------------------------------------------------------------

# Route Workflow

Typical inspection route workflow:

1.  Inspector opens assigned route
2.  Route loads extinguisher list in defined order
3.  Inspector walks facility in order
4.  Each extinguisher inspection is recorded
5.  Progress updates in real time

------------------------------------------------------------------------

# Route Progress Tracking

The system should display:

-   route progress percentage
-   remaining extinguishers
-   completed inspections
-   failed inspections

This allows supervisors to track inspection completion across teams.

------------------------------------------------------------------------

# Route Editing

Routes may be edited by:

-   Owner
-   Admin

Inspectors typically use routes but should not modify them.

------------------------------------------------------------------------

# Route Optimization (Future)

Future enhancements may include:

-   automatic route optimization
-   shortest walking path calculation
-   indoor map integration
-   GPS-assisted routing
