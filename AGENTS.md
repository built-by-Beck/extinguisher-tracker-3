# Repository Guidelines

## Project Structure & Module Organization

- App code in `src/` (React + TypeScript, Vite). Common dirs: `src/pages`, `src/components`, `src/routes`, `src/lib`, `src/utils`, `src/types`.
- Firebase Cloud Functions in `functions/` (TypeScript). Entry `functions/src/index.ts` → compiled to `functions/lib/`.
- Static assets in `public/` and `media/`. Production build in `dist/`.
- Firebase config at repo root: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`.

## Build, Test, and Development Commands

- `pnpm dev` — start Vite dev server on `5173`.
- `npm --prefix functions run build` — compile Cloud Functions (TypeScript → `functions/lib/`).
- `pnpm emulators` — start Firebase emulators (build functions first).
- `pnpm build` — type-check and build app to `dist/`.
- `pnpm preview` — serve the production build locally.
- `pnpm lint` — run ESLint across the repo.
- `pnpm format` — run Prettier (`--write`) on the repo, excluding paths in `.prettierignore` (style; ESLint stays the correctness gate).
- `pnpm format:check` — Prettier `--check` on the same scope (CI-friendly once the tree matches Prettier output).
- `pnpm secrets:push` — push Stripe secrets from `functions/.env.secret`.

## AI Workflow

- Use PBRD Lite + Full PBRD from `docs/AI_WORKFLOW.md` and `.cursor/rules/pbrd-lite.mdc`.
- Classify each coding task as SMALL, MEDIUM, or LARGE before editing.
- SMALL tasks use PBRD Lite: minimal context, 1-3 bullet mini plan, changed-file review, and no Document Agent unless user-facing behavior changed.
- MEDIUM tasks use focused Plan + Build + Review; run Document only when docs or user-facing behavior changed.
- LARGE/high-risk tasks use Full PBRD.
- Agent files live in `agents/.claude/agents/`, `agents/.codex/agents/`, and Cursor project agents in `.cursor/agents/`.
- Never skip review for Firestore rules, auth, Stripe, billing, subscription gating, user permissions, data deletion, data migration, customer data, security-sensitive code, production deployment, replacement workflow, or monthly workspace source-of-truth logic.

## Coding Style & Naming Conventions

- TypeScript strict mode; 2-space indentation.
- Components in PascalCase (e.g., `InventoryTable.tsx`); hooks start with `use...`.
- Use `.tsx` for components and `.ts` for non-JSX modules; prefer named exports and small, focused modules.
- Resolve ESLint findings before merging.

## Testing Guidelines

- No runner configured yet. If adding tests, use Vitest + React Testing Library.
- Colocate tests as `*.test.ts(x)` next to sources; keep deterministic and cover core logic.

## Commit & Pull Request Guidelines

- Use clear, imperative subjects with optional scope, e.g., `pages: fix inventory scan`.
- Reference issues (e.g., `Fixes #123`). Include screenshots/GIFs for UI changes and emulator steps to verify.
- Call out breaking changes, data shape updates, and any Firestore rule/index changes.

## Environment, Emulators & Secrets

- Root `.env` — copy from `.env.example`; set `VITE_USE_EMULATORS=true` for local dev.
- `functions/.env` — copy from `functions/.env.example` (Stripe price IDs).
- Emulator Stripe secrets in `functions/.secret.local`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Without real Stripe test keys, Stripe-touching functions will error; Auth/Firestore/Storage emulation still works.
- Startup sequence: 1) `npm --prefix functions run build` 2) `pnpm emulators` 3) `pnpm dev`. Emulator ports: 9099, 8080, 5001, 9199, 4000.
- Port conflicts on restart? Kill stray processes:

```bash
lsof -ti :9099 -ti :8080 -ti :5001 -ti :9199 -ti :4000 | sort -u | xargs -r kill -9
```

## Cursor Cloud specific instructions

### Environment files

The update script handles dependency installation and Cloud Functions compilation. Before starting services, create env files if they don't exist:

```bash
cp -n .env.example .env
cp -n functions/.env.example functions/.env
cp -n functions/.env.secret.example functions/.secret.local
```

Then ensure `.env` has at minimum:

```
VITE_FIREBASE_PROJECT_ID=demo-ex3
VITE_FIREBASE_API_KEY=fake-api-key
VITE_USE_EMULATORS=true
```

And `functions/.secret.local` has placeholder Stripe secrets (required by `defineSecret`):

```
STRIPE_SECRET_KEY=sk_test_fake
STRIPE_WEBHOOK_SECRET=whsec_fake
```

### Starting services

Follow the startup sequence from the "Environment, Emulators & Secrets" section above. Use `--project demo-ex3` with emulators to avoid needing real Firebase credentials:

```bash
firebase emulators:start --project demo-ex3
```

The `demo-` prefix tells emulators to run in fully offline mode with no auth against real Firebase services.

### pnpm build scripts

`package.json` includes `pnpm.onlyBuiltDependencies` to allowlist `esbuild`, `@firebase/util`, and `protobufjs` postinstall scripts. Without this, Vite will fail because esbuild's native binary won't be installed.

### Testing

- Frontend: `pnpm test` (Vitest, 10 suites / 86 tests)
- Backend: `cd functions && npm test` (Jest, 11 suites / 45 tests)
- Lint: `pnpm lint`

### Known emulator-mode limitations

- The `createOrganization` Cloud Function may fail with an "internal" error in emulator mode due to Stripe `defineSecret` not resolving real values. Auth, Firestore reads/writes, and Storage all work normally.
- Pub/Sub-triggered functions (`complianceReminderJob`, `overdueDetectionJob`, `cleanupExpiredGuestsJob`) are skipped because the Pub/Sub emulator is not configured.
- Vertex AI / Gemini client-side features require a real Firebase project with billing enabled and will not work in demo mode.
