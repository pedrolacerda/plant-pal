# 🌿 Meu Jardim — Plant Pal

A mobile-first Progressive Web App (PWA) for managing your houseplants and keeping track of their care schedules.

## Features

- **Plant management** — Add, edit, and delete plants with a name, light level, and optional photo.
- **Customizable care intervals** — Set personalized watering, fertilizing, and spraying schedules per plant, or rely on sensible defaults based on light level.
- **AI-generated care tips** — Each plant can store an AI-generated care tip.
- **Care calendar** — Monthly calendar view showing all scheduled care tasks for every plant.
- **Upcoming tasks** — At-a-glance list of care tasks due in the next 7 days.
- **Push notifications** — Browser notifications remind you when plants need attention.
- **Secure authentication** — User accounts powered by Supabase Auth; every user sees only their own plants (Row Level Security enforced in the database).
- **Offline-ready** — Installable PWA with a service worker for offline use.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite |
| UI components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS |
| Backend / Auth / DB | Supabase (PostgreSQL + Row Level Security) |
| Data fetching | TanStack Query v5 |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest + Testing Library |
| AI Agent | GitHub Copilot SDK (Node.js) + GitHub Models API |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A [Supabase](https://supabase.com/) project with the schema described in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

### Installation

```sh
# 1. Clone the repository
git clone https://github.com/pedrolacerda/plant-pal.git
cd plant-pal

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous (public) key |
| `VITE_AGENT_URL` | PlantBot agent server URL (default: `http://localhost:3001`) |
| `VITE_GITHUB_MODELS_API_KEY` | GitHub Models API key — also sent as bearer token to the agent server |

## PlantBot — AI helper agent

PlantBot is a conversational assistant built with the [GitHub Copilot SDK](https://github.com/github/copilot-sdk). It runs as a separate Node.js server in the `agent/` directory.

### Features

| Capability | Tool invoked |
|---|---|
| Disease & health diagnosis | `identify_disease` |
| Care routines (watering, fertilizing, repotting) | `get_care_routine` |
| Accessory & supply recommendations | `recommend_accessories` |
| General plant questions | Direct model response |

PlantBot automatically knows about the user's registered plants and adapts answers to match the language the user writes in (Portuguese or English).

### Architecture

```
Browser (React)
  └─ PlantAssistantChat.tsx  ← floating chat button + overlay
       ↓ HTTP POST + SSE
  agent/ (Node.js + Express)
    ├─ CopilotClient (singleton, BYOK via GitHub Models API)
    ├─ Session map: userId → CopilotSession
    └─ Custom tools (identify_disease, get_care_routine, recommend_accessories)
```

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) installed and available in your `PATH` — the Copilot SDK spawns it as a subprocess

### Running the agent server

```sh
# 1. Install agent dependencies
cd agent
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit agent/.env and set GITHUB_MODELS_API_KEY (and optionally AGENT_API_KEY)

# 3. Start the agent server (development)
npm run dev
# Agent server now listening on http://localhost:3001
```

The frontend reads `VITE_AGENT_URL` from `.env.local` to know where to connect. Both the frontend dev server and the agent server need to be running concurrently during development:

```sh
# Terminal 1 — frontend
npm run dev

# Terminal 2 — agent
cd agent && npm run dev
```

### Agent environment variables (`agent/.env`)

| Variable | Required | Description |
|---|---|---|
| `GITHUB_MODELS_API_KEY` | ✅ | GitHub Models API key (same key as Supabase Edge Functions) |
| `AGENT_API_KEY` | ❌ | Shared secret for frontend→backend auth. Leave blank in dev to disable. |
| `PORT` | ❌ | Port to listen on (default: `3001`) |
| `ALLOWED_ORIGIN` | ❌ | Frontend URL for CORS (default: `http://localhost:8080`) |

## Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server with hot-reload |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |

## Database schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the full schema, including the `plants` table definition and Row Level Security policies.

## Project structure

```
agent/                    # PlantBot agent server (Copilot SDK + Express)
├── src/
│   ├── agent.ts          # CopilotClient singleton + session manager
│   ├── index.ts          # Express server (POST /chat, DELETE /chat/:userId)
│   └── tools/
│       ├── plants.ts     # identify_disease tool
│       ├── care.ts       # get_care_routine tool
│       └── accessories.ts # recommend_accessories tool
├── .env.example
└── package.json
src/
├── components/           # UI components (PlantCard, PlantForm, CareCalendar, …)
│   └── PlantAssistantChat.tsx  # Floating PlantBot chat overlay
├── hooks/                # Custom React hooks (useAuth, usePlants, …)
├── integrations/         # Supabase client setup
├── lib/                  # Core logic (plantCare utilities, notifications)
├── pages/                # Route-level pages (Index, Auth, NotFound)
└── main.tsx              # App entry point
```

## Contributing

1. Fork the repository and create a feature branch.
2. Make your changes and add tests where applicable.
3. Run `npm run lint` and `npm test` to ensure everything passes.
4. Open a pull request describing your changes.
