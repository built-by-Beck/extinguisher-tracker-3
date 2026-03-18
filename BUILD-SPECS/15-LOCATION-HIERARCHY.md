# 15 — Location Hierarchy

The Location Hierarchy system defines how facilities are structured inside Extinguisher Tracker 3 (EX3).

Organizations may operate across complex physical environments such as:

- hospitals
- university campuses
- multi‑building warehouses
- large industrial facilities
- commercial office parks
- multi‑site organizations

The location hierarchy allows the platform to organize extinguisher inventory, inspection workflows, and compliance reporting in a **structured geographic model**.

Reference source: turn4file0

## Location Hierarchy Model

Locations are organized in a **parent–child hierarchical structure**.

Example hierarchy:

```
Campus
 Building
  Floor
   Wing / Zone
    Room / Area
```

This allows inspectors and administrators to easily navigate facilities and group extinguishers logically.

## Firestore Structure

Locations are stored under the organization.

`org/{orgId}/locations/{locationId}`

Example structure:

```
org/{orgId}/locations/{locationId}
  name
  parentLocationId
  locationType
  description
  createdAt
  updatedAt
```

## Location Types

Supported location types include:

- `campus`
- `building`
- `floor`
- `wing`
- `zone`
- `room`
- `mechanical`
- `outdoor`

Additional types may be added in the future without schema changes.

## Parent–Child Relationships

Every location may optionally reference a parent location.

Example:

```
Campus A
  Building B
    Floor 3
      Mechanical Room 3A
```

In the database:

```
locationId: floor3
parentLocationId: buildingB
```

This relationship allows the system to construct facility trees.

## Location Navigation

The UI must allow users to:

- browse hierarchical location trees
- filter extinguishers by location
- navigate inspection routes through locations
- view compliance dashboards per location

Example filters:

- building
- floor
- zone
- room

## Location Assignment

Each extinguisher must be assigned to a location.

Example:

```
extinguisher.locationId = room3A
```

The system may optionally store:

- location name snapshot
- location hierarchy snapshot

This protects inspection history if the location structure changes later.

## Location Permissions

Location management is limited to:

- **Owner**
- **Admin**

Inspectors may view locations but should not modify hierarchy structure.

## Location Reporting

The hierarchy enables reports such as:

- inspections by building
- overdue extinguishers by floor
- compliance heat maps
- section progress reports

These reports are important for large organizations managing hundreds or thousands of extinguishers.
