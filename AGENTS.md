# Repository Guidelines

## Project Structure & Module Organization
- App code in `src/` (React + TypeScript, Vite). Common dirs: `src/pages`, `src/components`, `src/routes`, `src/lib`, `src/utils`, `src/types`.
- Firebase Cloud Functions in `functions/` (TypeScript). Entry `functions/src/index.ts` → compiled to `functions/lib/`.
- Static assets in `public/` and `media/`. Build output in `dist/`.
- Firebase config: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`.

## Build, Test, and Development Commands
- `pnpm dev` — start Vite dev server (5173).
- `npm --prefix functions run build` — compile Cloud Functions.
- `pnpm emulators` — start Firebase emulators (build functions first).
- `pnpm build` — type-check then build to `dist/`.
- `pnpm preview` — serve the production build locally.
- `pnpm lint` — run ESLint across the repo.
- `pnpm secrets:push` — push Stripe secrets from `functions/.env.secret`.

## Coding Style & Naming Conventions
- TypeScript strict mode; 2-space indentation.
- React components in PascalCase (e.g., `InventoryTable.tsx`); hooks start with `use...`.
- Use `.tsx` for components, `.ts` for non-JSX modules. Prefer named exports and small, focused modules.
- Resolve ESLint findings before merging. Note: `pnpm lint` currently reports 14 pre-existing errors; they do not block build/runtime.

## Testing Guidelines
- No runner configured yet. If adding tests, use Vitest + React Testing Library.
- Colocate tests as `*.test.ts(x)` next to sources; keep deterministic and cover core logic.

## Commit & Pull Request Guidelines
- Write clear, imperative subjects with optional scope (e.g., `pages: fix inventory scan`).
- Reference issues (`Fixes #123`) and include screenshots/GIFs for UI changes and emulator steps to verify.
- Call out breaking changes, data shape updates, or Firestore rule/index changes.

## Environment, Emulators & Secrets
- Root `.env` — copy from `.env.example`; set `VITE_USE_EMULATORS=true` for local dev.
- `functions/.env` — copy from `functions/.env.example` (Stripe price IDs).
- Emulator Stripe secrets in `functions/.secret.local`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Without real Stripe test keys, Stripe-touching functions will error; Auth/Firestore/Storage emulation still works.
- Startup sequence: 1) `npm --prefix functions run build` 2) `pnpm emulators` 3) `pnpm dev`. Emulator ports: 9099, 8080, 5001, 9199, 4000.
- Port conflicts on restart? Kill stray processes:
```
lsof -ti :9099 -ti :8080 -ti :5001 -ti :9199 -ti :4000 | sort -u | xargs -r kill -9
```

