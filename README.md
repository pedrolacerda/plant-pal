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
src/
├── components/       # UI components (PlantCard, PlantForm, CareCalendar, …)
├── hooks/            # Custom React hooks (useAuth, usePlants, …)
├── integrations/     # Supabase client setup
├── lib/              # Core logic (plantCare utilities, notifications)
├── pages/            # Route-level pages (Index, Auth, NotFound)
└── main.tsx          # App entry point
```

## Contributing

1. Fork the repository and create a feature branch.
2. Make your changes and add tests where applicable.
3. Run `npm run lint` and `npm test` to ensure everything passes.
4. Open a pull request describing your changes.
