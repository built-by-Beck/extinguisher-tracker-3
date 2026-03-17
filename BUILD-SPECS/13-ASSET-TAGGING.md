# 13 --- Barcode and QR Asset Tagging

The asset tagging system enables fast field identification of
extinguishers using barcodes or QR codes.

Reference source: turn3file2

------------------------------------------------------------------------

# Asset Identity Fields

Each extinguisher may contain:

-   assetId
-   barcode
-   QR code

All identifiers must be stored as **strings**.

------------------------------------------------------------------------

# Tag Scanning Workflow

When a tag is scanned:

1.  Device camera reads barcode or QR code
2.  Application searches extinguisher inventory
3.  Matching record opens automatically
4.  Inspector proceeds to inspection workflow

This enables extremely fast field inspections.

------------------------------------------------------------------------

# Plan‑Based Feature Access

Feature availability depends on subscription plan.

## Basic

-   manual entry of assetId
-   manual barcode input
-   reminders available

Optional add‑on:

barcode scanning module

## Pro and Higher

-   camera scanning
-   QR code scanning
-   instant record lookup
-   scan‑to‑inspect workflow

------------------------------------------------------------------------

# Tag Generation

The platform may generate printable asset tags.

Tag types:

-   barcode labels
-   QR labels

Generated tags include:

-   assetId
-   encoded barcode or QR value
-   optional organization name

------------------------------------------------------------------------

# Tag Printing

Organizations may export tags as:

-   PDF sheets
-   label printer formats

Tags must remain **unique within an organization**.

------------------------------------------------------------------------

# Duplicate Protection

System must prevent:

-   duplicate barcodes
-   duplicate assetIds
-   duplicate QR identifiers

Duplicate detection should occur during:

-   manual entry
-   CSV import
-   tag assignment
