# 12 — Extinguisher Lifecycle Engine

The lifecycle engine is responsible for calculating inspection due
dates, maintenance schedules, and compliance status for every
extinguisher in the system.

Reference source: turn3file1

---

## Lifecycle Inputs

The engine calculates due dates using the following inputs:

- manufacture date
- install date
- inspection history
- maintenance history
- extinguisher type
- hydro interval rules

These values determine future inspection and maintenance requirements.

---

## Lifecycle Outputs

The engine produces calculated fields stored on the extinguisher record.

Fields include:

```
nextMonthlyInspection
nextAnnualInspection
nextSixYearMaintenance
nextHydroTest
complianceStatus
```

These values are recalculated whenever inspection or maintenance records
change.

---

## Lifecycle States

Extinguishers move through lifecycle states.

Supported states:

- `active`
- `replaced`
- `retired`

### Active

Extinguisher remains in service.

All compliance rules apply.

### Replaced

Extinguisher replaced with new unit.

Historical records preserved.

Replacement record must include:

- old `assetId`
- new `assetId`
- replacement date
- `performedBy`

### Retired

Extinguisher permanently removed from service.

Lifecycle tracking stops but historical records remain accessible.

---

## Compliance States

Lifecycle engine also assigns compliance states.

Examples:

- `compliant`
- `inspection_due`
- `overdue`
- `maintenance_due`
- `hydro_due`

Compliance states drive:

- alerts
- reminders
- dashboards
- reports

---

## Calculation Rules

### Monthly Inspection

```
nextMonthlyInspection = lastInspection + 30 days
```

### Annual Inspection

```
nextAnnualInspection = lastAnnual + 12 months
```

### Six-Year Maintenance

```
nextSixYearMaintenance = lastSixYear + 6 years
```

### Hydrostatic Testing

```
nextHydroTest = lastHydroTest + intervalYears
```

Intervals depend on extinguisher type.

---

## Trigger Events

Lifecycle recalculation runs when:

- inspection completed
- maintenance logged
- extinguisher created
- extinguisher replaced
- type changed
