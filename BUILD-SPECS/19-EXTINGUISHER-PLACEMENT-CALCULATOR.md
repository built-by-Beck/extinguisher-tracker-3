# 19 — Extinguisher Placement Calculator

This document defines the **Extinguisher Placement Calculator** feature for **Extinguisher Tracker 3 (EX3)**.

The calculator is based on the earlier **FireSafe Advisor** project and adapts that concept into the EX3 platform as a structured, organization-aware planning tool.

The purpose of this feature is to help organizations estimate:

- the number of fire extinguishers required for a space
- the recommended extinguisher types
- strategic placement guidance
- hazard-based extinguisher coverage needs
- relevant NFPA reference points
- planning recommendations that can later be turned into inventory records

This feature is designed as a **planning and advisory tool**, not as a substitute for a licensed fire protection engineer, certified fire safety professional, Authority Having Jurisdiction (AHJ), or official code review.

---

## Purpose

The Extinguisher Placement Calculator helps organizations make better decisions before or during extinguisher program setup.

It is intended to support use cases such as:

- planning extinguisher placement in a new space
- reviewing extinguisher coverage in an existing building
- estimating extinguisher needs during facility expansion
- providing quick advisory guidance to maintenance and safety teams
- helping small organizations understand likely extinguisher requirements
- supporting future conversion of calculated recommendations into inventory records

This feature should strengthen the product’s position as a **fire safety compliance platform**, not just an inspection tracker.

---

## Product Positioning

The placement calculator is a **decision-support tool**.

It does not make legally binding code determinations on its own.

It should always return a clear disclaimer that:

- recommendations are informational
- local code adoption and AHJ interpretation may vary
- final extinguisher placement and code compliance should be verified by qualified professionals

This tool should help users become more informed and prepared, but it must not claim to replace a certified fire protection expert.

---

## Core Use Cases

The calculator must support scenarios such as:

- a hospital safety team evaluating a floor or department
- a small business owner checking extinguisher needs for a new office
- a warehouse manager reviewing hazard-based extinguisher coverage
- a property manager estimating extinguisher placement for multiple units
- a maintenance team reviewing extinguisher type recommendations before purchase
- an organization creating extinguisher inventory from calculated recommendations

---

## Calculator Input Model

The calculator must accept structured user input describing the area under review.

### Required Inputs

#### Room Dimensions
- length in feet
- width in feet
- height in feet

#### Occupancy Type
The general use of the space.

Examples:
- room
- office
- hospital floor
- warehouse
- kitchen
- mechanical room
- laboratory
- storage room
- corridor
- retail area

#### Hazard Level
The general fire risk level.

Supported values:
- light
- ordinary
- extra

#### Potential Hazards
A checklist of applicable fire classes.

Supported values:
- Class A
- Class B
- Class C
- Class D
- Class K

### Optional Future Inputs

The system should be designed so additional inputs can be added later without redesigning the feature.

Examples:
- square footage override
- fuel load description
- cooking operations present
- flammable liquids present
- energized electrical equipment present
- metal fire risk present
- occupancy load
- building type
- floor designation
- corridor length
- AHJ notes
- local code edition override

---

## Calculator Output Model

The calculator returns a structured recommendation.

### Required Outputs

#### Number of Extinguishers
A recommended estimated number of extinguishers for the described space.

#### Extinguisher Types
The extinguisher type recommendations.

Examples:
- ABC
- BC
- CO2
- Water
- K-Class
- Class D

#### Placement Recommendations
A written description of where extinguishers should likely be placed.

Examples:
- near exits
- near corridors
- near hazard zones
- near kitchens
- near mechanical areas
- distributed to maintain travel distance expectations

#### NFPA References
A list of relevant NFPA reference points used to justify or frame the recommendation.

These references should be short, readable, and presented as advisory references rather than legal determinations.

#### Disclaimer
A standard legal / compliance disclaimer.

### Optional Future Outputs

The system should be extensible so future versions may also return:

- estimated travel distance coverage notes
- hazard-specific rationale
- placement zones
- coverage gap warnings
- recommended extinguisher mounting notes
- suggested installation count by floor
- confidence / review-needed flag
- exportable planning summary
- conversion-ready inventory seed data

---

## Integration with EX3

The placement calculator should be integrated into EX3 as a first-class feature.

### Integration Goals

The feature should support:

- in-app planning workflows
- advisory calculations tied to an organization
- optional saving of planning runs
- future conversion of calculator output into extinguisher inventory
- future location-aware planning tied to the location hierarchy
- future route and compliance integration

### Suggested Navigation Placement

The calculator may be available from:

- dashboard quick actions
- tools menu
- admin planning section
- organization tools page

### Suggested CTA Labels

Examples:
- Run Placement Calculator
- Calculate Extinguisher Needs
- Plan Extinguisher Placement
- Generate Safety Recommendation

---

## Plan Access

The calculator is valuable enough to be offered broadly.

### Recommended Access Model

#### Basic
Include the calculator.

Reason:
Small businesses often need help understanding basic extinguisher needs and are strong candidates for this feature.

#### Pro
Include calculator plus future enhanced outputs.

#### Elite
Include calculator plus future advanced planning workflows.

#### Enterprise
Include full calculator support and future custom rules/integrations.

### Current Recommendation

The base calculator should be available on **all paid plans**.

Future advanced placement mapping or bulk planning may be restricted to higher tiers later.

---

## Calculator Workflow

A typical calculator workflow should be:

1. User opens the calculator
2. User enters room dimensions
3. User selects occupancy type
4. User selects hazard level
5. User checks applicable fire classes
6. User submits calculation
7. System processes request
8. Structured recommendation is returned
9. User may save, export, or use result for planning

### Optional Future Flow

10. User clicks **Create Inventory From Recommendation**
11. System creates draft extinguisher inventory records
12. User assigns sections/locations
13. User begins actual compliance tracking in EX3

---

## Technical Origin

This calculator is based on the earlier **FireSafe Advisor** project.

The original project brief describes it as:

- a web application for extinguisher placement recommendations
- based on NFPA guidance
- using AI to analyze room and hazard inputs
- returning a structured recommendation

The original implementation stack included:

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Genkit
- Google Gemini integration
- React Hook Form
- Zod validation

For EX3, the feature must be integrated into the broader SaaS system and may be reimplemented using the EX3 architecture rather than requiring the original stack exactly.

---

## Technical Design Requirements

The EX3 calculator implementation must fit within the EX3 application architecture.

### Frontend Requirements

The calculator UI must support:

- responsive layout
- structured validated form input
- clear loading state
- clear results state
- clear error state
- mobile-first usability
- touch-friendly form controls
- accessibility labels and validation messages

### Backend Requirements

The backend must support:

- trusted calculation execution
- structured input validation
- structured output validation
- rate limiting or abuse protection if needed
- audit logging where appropriate
- org-scoped save/history support if calculator runs are stored

### Validation Requirements

Inputs must be validated before submission.

Minimum validation includes:
- positive numeric values for room dimensions
- required occupancy type
- required hazard level
- at least zero or more selected hazards
- safe handling of empty or malformed input

---

## AI-Assisted Advisory Logic

The original FireSafe Advisor concept used AI to generate structured recommendations.

That approach may still be used inside EX3, but it must follow stricter product rules.

### AI Use Rules

If AI is used:

- output must follow a structured schema
- output must be validated before display
- AI must be instructed to behave as a fire safety advisor, not as a legal authority
- the system must always include a disclaimer
- the system must never imply guaranteed code compliance
- AI output should remain bounded, explainable, and user-friendly

### Recommendation Framing

The output should be framed as:

- recommendation
- estimate
- planning guidance
- advisory safety suggestion

Not as:
- final code approval
- legal certification
- engineering seal
- AHJ override

---

## Calculation Inputs Schema

The calculator should use a structured input schema.

### Required Input Fields

```text
roomDimensions:
  length: number
  width: number
  height: number

occupancyType: string
hazardLevel: string
potentialHazards: string[]
```

### Example Input

```json
{
  "roomDimensions": {
    "length": 40,
    "width": 30,
    "height": 10
  },
  "occupancyType": "Hospital Floor",
  "hazardLevel": "ordinary",
  "potentialHazards": ["Class A", "Class C"]
}
```

---

## Calculation Output Schema

The output should follow a structured schema.

### Required Output Fields

```text
numberOfExtinguishers: number
extinguisherTypes: string[]
placementRecommendations: string
nfpaReferences: string[]
disclaimer: string
```

### Example Output

```json
{
  "numberOfExtinguishers": 4,
  "extinguisherTypes": ["ABC"],
  "placementRecommendations": "Place extinguishers near exits, corridor intersections, and evenly distributed travel paths so that recommended travel distance expectations are maintained.",
  "nfpaReferences": [
    "NFPA 10 portable extinguisher placement guidance",
    "Class A travel distance considerations",
    "Hazard-level based extinguisher distribution guidance"
  ],
  "disclaimer": "This recommendation is for informational purposes only. Final extinguisher placement and code compliance should be reviewed by a qualified professional and the Authority Having Jurisdiction."
}
```

---

## Results Display Requirements

The results display should include four clear states.

### 1. Initial State
Prompt user to enter room and hazard information.

### 2. Loading State
Show loading skeleton or progress state while calculation runs.

### 3. Results State
Display:
- number of extinguishers
- extinguisher types
- placement guidance
- NFPA references
- disclaimer

### 4. Error State
Display clear message if calculation fails or input is invalid.

---

## UI Requirements

The calculator UI should be clean, mobile-friendly, and easy to understand.

### Input Form Requirements

The form should include:
- dimension inputs
- occupancy type selector
- hazard level selector
- hazard class checklist
- submit button
- reset or clear option

### Results UI Requirements

The results view should include:
- structured recommendation summary
- badges or tags for extinguisher types
- prominent disclaimer alert
- optional save/export actions
- optional create-inventory action in future versions

### Accessibility Requirements

- labeled fields
- validation feedback
- keyboard accessible controls where relevant
- clear error text
- no color-only meaning

---

## Save and History Behavior

The calculator may support saved calculation history in future versions.

### Optional Future Collection

```text
org/{orgId}/placementCalculations/{calcId}
```

### Example Stored Fields

```text
name: string | null
input: map
output: map
createdAt: Timestamp
createdBy: string
updatedAt: Timestamp | null
```

### Use Cases for Saving

- compare planning runs
- attach to facility review process
- revisit earlier recommendations
- convert planning results into inventory drafts later

For v1, this feature may be optional.

---

## Conversion to Inventory

One of the most valuable future workflows is turning calculator output into real inventory records.

### Future Inventory Conversion Workflow

1. User runs calculator
2. User reviews recommendation
3. User chooses to create draft inventory
4. System creates draft extinguisher records
5. User assigns:
   - location
   - section
   - type
   - quantity
6. User finalizes inventory

This would turn the calculator into a direct on-ramp for new customers.

---

## Role and Permission Expectations

### Who Can Use the Calculator

Recommended:
- owner
- admin
- inspector
- viewer, if business rules allow read-only access to the calculator

### Who Can Save / Convert Results

Recommended:
- owner
- admin

If saved calculation history is implemented, access must remain organization-scoped.

---

## Audit Logging Recommendations

The following events may be logged when appropriate:

- `placement_calculator.run`
- `placement_calculator.saved`
- `placement_calculator.exported`
- `placement_calculator.converted_to_inventory`

Example audit details:

```json
{
  "occupancyType": "Hospital Floor",
  "hazardLevel": "ordinary",
  "recommendedCount": 4
}
```

---

## Security and Compliance Rules

The calculator must follow the same core EX3 rules as the rest of the application.

### Required Rules

- organization context must be respected if results are saved
- one organization cannot access another organization’s saved calculations
- AI output must not bypass product disclaimers
- exports must remain org-scoped
- user role must be checked before save/convert actions
- the calculator must not claim legal certification

---

## Suggested Build Integration

If implemented with a separate advisory logic module, recommended components include:

- validated input schema
- validated output schema
- trusted server-side calculation function
- reusable result renderer
- plan-aware UI integration
- optional save/export hooks

If AI is used, keep the logic behind a trusted server-side boundary.

---

## Final Requirement

The Extinguisher Placement Calculator must be implemented as a **planning and advisory tool** that helps organizations estimate extinguisher needs using structured facility input and NFPA-aligned guidance.

It must:

- produce structured output
- remain clearly advisory
- include a disclaimer
- support mobile and desktop use
- be extensible for future inventory conversion
- fit cleanly into the EX3 SaaS architecture
