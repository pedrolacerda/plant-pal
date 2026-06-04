# Plant Pal — Copilot instructions

Mobile-first PWA for houseplant care. React 18 + TypeScript + Vite, Supabase backend, plus an AI helper agent (PlantBot).

## Commands

- `npm run dev` — dev server on **port 8080** (not Vite's default 5173). Proxies `/chat` and `/health` to `http://localhost:3001` (the agent).
- `npm run build` — production build (Vite + PWA/Workbox).
- `npm test` — run the Vitest suite once. Single test: `npx vitest run src/test/careAmounts.test.ts`. Watch mode: `npm run test:watch`.
- `npm run lint` — ESLint over the repo.

## Architecture

- **Frontend:** React 18 + TypeScript, Vite, shadcn/ui + Radix, Tailwind, TanStack Query v5, React Router. Installable PWA via `vite-plugin-pwa` (service worker source in `src/sw.ts`).
- **Backend:** Supabase (PostgreSQL with Row Level Security — every user sees only their own plants). Schema in `DATABASE_SCHEMA.md`, migrations in `supabase/migrations/`, Edge Functions in `supabase/functions/` (`care-notifications`, `diagnose-plant`, `identify-plant`, `plant-care`).
- **Care logic:** centralized in `src/lib/plantCare.ts` (intervals, amounts, defaults by light level). Notifications in `src/lib/notifications.ts`.
- **Data layer:** Supabase client in `src/integrations/supabase/` (generated `types.ts`); data access via hooks in `src/hooks/` (e.g. `usePlants.tsx`, `useAuth.tsx`).
- **Chat UI:** `src/components/PlantAssistantChat.tsx` talks to the agent over HTTP POST + SSE at `${VITE_AGENT_URL}/chat`.

## PlantBot agent (separate repo)

The PlantBot agent is **not** in this repository. It was extracted to `~/Development/plant-pal-agent` (commit `93aeb56`). Any README references to an `agent/` directory here are stale — do not look for or recreate an in-repo `agent/` folder. Work on agent code in the standalone repo.

## Deployment

- The frontend deploys to **Vercel** (`plantpal.pedrolacerda.me`, project `plant-pal`).
- The chat agent endpoint is configured via the **`VITE_AGENT_URL`** environment variable, which is **baked in at build time** — changing it requires a Vercel rebuild/redeploy, not just an env update.
- The agent is reached through an ngrok tunnel (`plantpal-agent.ngrok.app`) managed by a launchd `ngrok start --all` service alongside the Hermes webhook tunnel — do not remove the Hermes tunnel when editing ngrok config.
- When verifying a deploy, account for **PWA service-worker caching**: a hard refresh / cache-bust is needed to confirm the new bundle is live, and watch for CORS preflight failures on the agent origin.

## Conventions

- TypeScript path alias `@/` maps to `src/` (see `vite.config.ts` / `tsconfig`).
- UI built from shadcn/ui primitives in `src/components/ui/`; prefer composing these over new primitives.
- Adapt user-facing AI/chat copy to the user's language (Portuguese or English).
