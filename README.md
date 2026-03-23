# Extinguisher Tracker 3 (EX3)

A professional, operational system for fire extinguisher inspections, inventory management, and NFPA 10 compliance. Built for maintenance teams who need to move beyond paper binders and disconnected spreadsheets.

## Key Features

*   **Lightning Fast Scanning:** Use your phone camera to scan barcodes and QR codes for instant extinguisher lookup.
*   **AI Maintenance Helper:** Built-in assistant trained on NFPA 10 standards to answer compliance and maintenance questions on the fly.
*   **Placement Calculator:** Integrated tool to determine required extinguisher quantities and types based on hazard class and floor area.
*   **Smart Inventory:** Track assets with precise location hierarchy, vicinity details, and full replacement history.
*   **Compliance Dashboard:** Real-time visibility into passed, failed, and overdue inspections.
*   **Offline Support:** Perform inspections in areas with no connectivity; data syncs automatically when you're back online.
*   **Data Integrity:** Multi-tenant isolation and transactional backend updates ensuring no data loss.
*   **Restoration Tools:** Support for restoring full organization data from JSON backups and automatic duplicate detection.

## Tech Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS, Vite.
*   **Backend:** Firebase (Cloud Functions v2, Firestore, Auth, Hosting).
*   **Payments:** Stripe integration for tiered subscription management.
*   **Icons:** Lucide React.

## Development Workflow

This project uses a branch-based workflow for stability:
- **`dev` branch:** Active development and preview. Pushes here deploy to the [Dev Preview Channel](https://extinguisher-tracker-3--dev-2zat4bfo.web.app).
- **`main` branch:** Production-ready code. Merges to main deploy to the [Production Site](https://extinguisher-tracker-3.web.app).

### Commands
- `pnpm dev`: Start local development server.
- `pnpm build`: Build the production application.
- `npm run deploy:dev`: Build and deploy to the Firebase dev preview channel.
- `cd functions && npm test`: Run the backend logic and security test suite.

## Support
Created and maintained by **Beck-Publishing**.
