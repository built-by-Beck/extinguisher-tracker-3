# 11 --- NFPA Compliance System

This document defines the **NFPA compliance tracking framework**
implemented in Extinguisher Tracker 3 (EX3).

The system supports the inspection, maintenance, testing, and
documentation requirements commonly associated with **NFPA 10 --
Standard for Portable Fire Extinguishers**.

The goal of this subsystem is to ensure that organizations can:

-   track required inspection intervals
-   maintain historical compliance records
-   generate audit‑ready inspection documentation
-   identify overdue equipment
-   enforce legally defensible inspection workflows

Reference source: turn3file0

------------------------------------------------------------------------

# Compliance Model

The compliance engine supports the following NFPA inspection and
maintenance intervals.

## Monthly Inspection

Performed by internal personnel or designated inspectors.

Purpose:

Verify the extinguisher remains:

-   in its designated location
-   visible and accessible
-   properly pressurized
-   free from damage
-   equipped with safety pin and tamper seal

Typical inspection items:

-   location verified
-   unobstructed visibility
-   pressure gauge in operable range
-   safety pin present
-   tamper seal intact
-   no corrosion or leakage
-   hose intact
-   label legible

Monthly inspections generate an **inspection record** stored under:

    org/{orgId}/inspections

Each inspection must store:

-   inspector identity
-   timestamp
-   checklist results
-   optional notes
-   optional photo evidence
-   optional GPS location

------------------------------------------------------------------------

## Annual Inspection

Performed by a **qualified technician**.

Purpose:

Verify extinguisher mechanical integrity and readiness for service.

Annual inspections typically include:

-   internal examination
-   verification of extinguisher type
-   recharge verification
-   inspection tag update

Annual inspection records must include:

-   technician identity
-   certification status (optional future field)
-   inspection date
-   next annual due date

------------------------------------------------------------------------

## Six-Year Maintenance

Required for **stored-pressure dry chemical extinguishers**.

Purpose:

Internal examination and replacement of certain components.

Maintenance tasks may include:

-   discharge and inspection
-   replacement of O-rings and seals
-   reassembly and recharge

Fields tracked:

    lastSixYearMaintenance
    nextSixYearMaintenance
    performedBy

------------------------------------------------------------------------

## Hydrostatic Testing

Hydrostatic testing ensures cylinder integrity.

Supported intervals:

  Extinguisher Type   Hydro Interval
  ------------------- ----------------
  CO2                 5 years
  Water               5 years
  Wet Chemical        5 years
  Dry Chemical        12 years

The system must support **type‑specific intervals** so future
extinguisher types can be added without schema changes.

------------------------------------------------------------------------

# Compliance Status Flags

The system calculates compliance state automatically.

Possible states:

-   compliant
-   monthly_due
-   annual_due
-   six_year_due
-   hydro_due
-   overdue
-   missing_data

These states drive:

-   dashboard alerts
-   reminder notifications
-   compliance reports

------------------------------------------------------------------------

# Compliance Dashboard

Organizations must be able to quickly see compliance status.

Key dashboard indicators:

-   total extinguishers
-   compliant count
-   inspections due
-   overdue inspections
-   upcoming hydro tests
-   upcoming maintenance events

This dashboard allows safety managers to prioritize corrective actions.

------------------------------------------------------------------------

# Compliance Integrity Rules

To maintain audit‑grade data integrity:

-   inspection timestamps must never be overwritten
-   historical records must remain immutable
-   archived compliance reports must remain read‑only
-   inspection identity must always be preserved
-   lifecycle changes must be logged through audit logs

------------------------------------------------------------------------

# Compliance Reporting

Compliance records support:

-   internal safety reporting
-   insurance documentation
-   regulatory audits
-   corporate compliance reviews

Supported report formats:

-   CSV
-   Excel
-   JSON
-   PDF

Reports must always be **organization‑scoped**.

------------------------------------------------------------------------

# Compliance Automation

The system automatically recalculates compliance status when:

-   an inspection is completed
-   a maintenance record is updated
-   lifecycle status changes
-   an extinguisher is replaced
