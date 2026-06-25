# NexusOps AI

NexusOps AI is an operations command center for teams that manage clients, project delivery, revenue pipeline and external risk signals. It combines a validated project workflow, live weather intelligence, real-time collaboration and an AI copilot in one responsive interface.

## Why It Exists

Operational teams often make decisions with fragmented data: project status in one place, external conditions somewhere else, and decisions buried in chat. NexusOps AI turns those signals into a clear executive view: what is active, what is at risk, what changed recently and what should be prioritized next.

## Highlights

- Authenticated demo experience with role-based UI for `Admin`, `Manager` and `Analyst`.
- Server-side login with HTTP-only session cookies and a seeded demo user.
- Full project CRUD with schema validation through Zod.
- REST API in Express with Prisma ORM persistence for projects and activity history.
- Live Open-Meteo integration that turns weather data into operational recommendations.
- Smart alerts combining project deadline, priority, progress and climate risk.
- Dashboard with KPI cards and visual charts for portfolio health and revenue by status.
- Audit timeline for created, updated, deleted, AI and weather events.
- Real-time war room using `BroadcastChannel` for cross-tab chat state.
- AI copilot endpoint that keeps provider keys on the server and falls back gracefully without `OPENAI_API_KEY`.
- Automated tests for validation, risk scoring and analytics.

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- Prisma ORM
- Zod
- Vitest
- Lucide React
- Open-Meteo public API

## Product Demo Flow

1. Sign in with the demo credentials shown on the login screen.
2. Review pipeline, progress, high-priority work and smart alerts.
3. Start the guided demo to walk through the product story.
4. Create or edit a project and watch KPIs, charts and timeline update.
5. Switch the active role to `Analyst` to see read-only permissions.
6. Ask the war room copilot what should be prioritized.

## Running Locally

```bash
npm install
npm run db:push
npm run db:seed
npm run fullstack
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3333`

Demo credentials:

```txt
Email: erick@portfolio.dev
Password: Portfolio@2026
```

Authentication is handled by the Express API through:

```txt
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

The browser receives an HTTP-only session cookie, while the UI keeps a local fallback so the demo can still be explored if the backend is offline.

## AI Configuration

The app works without an AI key using a local operational fallback. To enable provider-backed responses, set:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Then run:

```bash
npm run fullstack
```

## API Routes

```txt
GET    /api/projects
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id
GET    /api/activity
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
POST   /api/ai-chat
```

Project and activity data are persisted through Prisma. The local development database uses SQLite at `prisma/dev.db`.

## Quality Checks

```bash
npm run lint
npm test
npm run build
```

Current status:

- Lint passing
- 5 automated tests passing
- Production build passing
- `npm audit` reports 0 vulnerabilities

## Architecture Notes

The frontend is intentionally resilient: it uses the Express API when available and falls back to browser storage when the backend is offline. This makes the demo easy to open while still showing a production-minded separation between UI, API routes, validation, persistence and external integrations.

The AI integration is routed through the server so API keys never touch the browser. The weather integration runs directly against Open-Meteo because it is a public, keyless data source.

The database layer uses Prisma. Local development is configured with SQLite because it runs anywhere without a database server. For production, switch `prisma/schema.prisma` to PostgreSQL and set `DATABASE_URL` to the managed database connection string.

Example PostgreSQL datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then run:

```bash
npx prisma migrate dev --name init
npm run db:seed
```

## Deployment

The repository includes:

- `render.yaml` for a Render web service.
- `Dockerfile` for container-based deployment.
- `.env.example` with required environment variables.
- Express production static serving for the Vite build.
- `/api/health` for deploy health checks.

Recommended deployment path:

### Fast Demo Deploy

Use this when you want a public portfolio link quickly. It runs the frontend and API as one Node service.

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm start
```

Environment variables:

```txt
DATABASE_URL=file:./dev.db
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=optional
```

Health check path:

```txt
/api/health
```

This SQLite demo mode is simple and works well for presenting the product. Some free hosting filesystems can reset between deploys, so use PostgreSQL for durable production data.

### Production Database Path

1. Create a PostgreSQL database on Render, Railway, Supabase or Neon.
2. Change Prisma datasource provider to `postgresql`.
3. Set `DATABASE_URL`, `OPENAI_API_KEY` and `OPENAI_MODEL` in the hosting dashboard.
4. Replace the local SQLite init script with Prisma migrations.
5. Run migrations and seed during deploy.

## Next Production Upgrades

- Move authentication to HTTP-only cookie sessions or a managed auth provider.
- Add component tests for the main dashboard interactions.
- Add a CI pipeline with lint, tests, build and migration checks.
- Add screenshots and a short demo video to the project page.
