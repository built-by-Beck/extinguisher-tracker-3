# Repository Guidelines

## Project Structure & Module Organization
- App code lives in `src/` (React + TypeScript, Vite). Common folders: `src/pages`, `src/components`, `src/routes`, `src/lib`, `src/utils`, `src/types`.
- Firebase Cloud Functions in `functions/` (TypeScript). Entry: `functions/src/index.ts` → built to `functions/lib/`.
- Static assets in `public/` and `media/`. Build output in `dist/`.
- Firebase config: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`.
- Project scripts in `scripts/` (e.g., secret sync).

## Build, Test, and Development Commands
- `pnpm dev` — start Vite dev server.
- `pnpm build` — type-check then build to `dist/`.
- `pnpm preview` — serve the production build locally.
- `pnpm lint` — run ESLint across the repo.
- `pnpm emulators` — start Firebase emulators. Use `pnpm emulators:import|export` to persist state.
- Functions:
  - `npm --prefix functions run build` — compile functions.
  - `npm --prefix functions run serve` — emulate functions locally.
  - `pnpm secrets:push` — push Stripe secrets from `functions/.env.secret`.

## Coding Style & Naming Conventions
- TypeScript strict mode is enabled (see `tsconfig.app.json`). Resolve ESLint findings before merging.
- 2-space indentation. React components in PascalCase (`InventoryTable.tsx`); hooks start with `use...`.
- Use `.tsx` for React components, `.ts` for non-JSX modules. Prefer named exports and small, focused modules.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Vitest + React Testing Library; colocate as `*.test.ts(x)` next to sources and keep tests deterministic. Aim for meaningful coverage on core business logic.

## Commit & Pull Request Guidelines
- Write clear, imperative subjects with optional scope (e.g., `pages: fix inventory scan`). Keep changes focused.
- Reference issues (`Fixes #123`). Include screenshots/GIFs for UI changes and emulator steps to verify behavior.
- Call out breaking changes, data shape updates, or Firestore rule/index changes in the PR description.

## Security & Configuration Tips
- Never commit secrets. Put Stripe secrets in `functions/.env.secret` (see `functions/.env.secret.example`) and run `pnpm secrets:push`.
- Use root `.env.example` and `functions/.env.example` as references for local envs. Keep `.env*` out of version control.
- Before deploying functions, ensure they build locally: `npm --prefix functions run build`.

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite dev server (frontend) | `pnpm dev` | 5173 | Hot-reloading React SPA |
| Firebase emulators (Auth, Firestore, Functions, Storage, UI) | `pnpm emulators` | 9099, 8080, 5001, 9199, 4000 | Must build functions first |

### Startup sequence

1. Build Cloud Functions before starting emulators: `npm --prefix functions run build`
2. Start emulators in one terminal: `pnpm emulators`
3. Start frontend in another terminal: `pnpm dev`

### Emulator secrets for Cloud Functions

The Firebase Functions emulator uses `defineSecret()` for Stripe keys. For local development, provide these in `functions/.secret.local` (not `.env.secret`):

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Without a real Stripe test key, any Cloud Function that touches Stripe (e.g., `createOrganization`) will fail with `StripeAuthenticationError`. Auth, Firestore, and Storage operations work fine with placeholder keys.

### Environment files needed

- Root `.env` — copy from `.env.example`, set `VITE_USE_EMULATORS=true` for local dev.
- `functions/.env` — copy from `functions/.env.example` (Stripe price IDs).
- `functions/.secret.local` — Stripe secret + webhook secret for emulator use.

### Known lint issues

`pnpm lint` reports 14 pre-existing errors (mostly `react-hooks/set-state-in-effect` and `react-refresh/only-export-components`). These are in the existing codebase and do not block the build or runtime.

### Port conflicts on emulator restart

When restarting emulators, child processes (Java for Firestore, etc.) may hold ports. Kill them by port before restarting:

```bash
lsof -ti :9099 -ti :8080 -ti :5001 -ti :9199 -ti :4000 | sort -u | xargs -r kill -9
```
