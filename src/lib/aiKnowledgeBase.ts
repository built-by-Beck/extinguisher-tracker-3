/**
 * Internal Knowledge Base for the AI Assistant.
 * Provides the AI with information about how the Extinguisher Tracker program works
 * so it can help users with app navigation and operations.
 */

export const APP_KNOWLEDGE_BASE = `
### Extinguisher Tracker 3 - App Navigation & How-To Guide

The AI Assistant should use this information to answer user questions about how to use the app.

**1. Managing Extinguishers (Inventory)**
- **How to add an extinguisher:** Go to the "Inventory" page using the sidebar, then click the red "Add Extinguisher" button in the top right. You can also add one from the Dashboard's "Quick Actions" section.
- **How to delete an extinguisher:** Go to the "Inventory" page. Click the "Edit" (pencil) icon next to the extinguisher you want to delete. Alternatively, from the "Extinguisher Detail" page, click "Edit Extinguisher". Scroll to the bottom of the edit form and click "Delete Extinguisher". This will soft-delete the asset.
- **How to import extinguishers:** Go to the "Inventory" page. For Elite/Enterprise plans, there is an "Import" button that allows you to upload a CSV, Excel, or JSON file. You can then map your columns to the system fields.
- **How to fix incomplete data:** Use the "Data Organizer" in the sidebar (Admin/Owner only). It shows all active extinguishers missing critical info (location, serial, etc.) and allows bulk assigning.

**2. Managing Workspaces (Inspections)**
- **What is a Workspace?** A workspace represents a monthly snapshot of your inventory used to conduct inspections.
- **How to create a workspace:** Go to the "Inspections" (Workspaces) page and click "Create Workspace". It will generate a workspace for the current month.
- **How to inspect an extinguisher:** Open a workspace. You will see a list of **Locations** (Buildings). Click on a Location to see the table of extinguishers assigned to it. Click on any extinguisher in the table to perform the inspection.
- **Customizing the view:** In both the Inventory and Workspace/Location tables, you can click the **"Columns"** button to toggle which information is visible (Asset ID, Serial, Building, Vicinity, Section, etc.).
- **How to delete a workspace:** Go to the "Inspections" page. On any workspace card (Active or Archived), click the "Delete" (trash can) button. Note: This permanently deletes the workspace and all its inspection records. Only Owners/Admins can delete workspaces.
- **How to archive a workspace:** Once inspections are complete, go to the "Inspections" page and click "Archive" on the workspace. This makes it read-only and generates a final compliance report.

**3. Locations**
- **How locations work:** Locations are strictly hierarchical. You build your tree of Buildings, Floors, and Rooms in the "Locations" page.
- **Assigning a location:** When creating or editing an extinguisher, or during an import, assigning the extinguisher to a specific Location will automatically place it in that Building/Section across all dashboard tiles and workspaces.

**4. Users and Settings**
- **How to add a team member:** Go to "Settings" -> "Members" tab. Click "Invite Member", type their email, and select their role (Admin, User, Viewer).
- **How to change a plan:** Go to "Settings" -> "Billing" tab.

*If a user asks how to do something not listed here, guide them to look through the main sidebar navigation (Dashboard, Inspections, Inventory, Data Organizer, Locations, Settings).*
`;
