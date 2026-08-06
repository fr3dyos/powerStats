# PowerStats 🥏

Ultimate Frisbee tournament statistics manager — live scoring, brackets,
round-robin scheduling, and player/team analytics.

## Author
Fredy Osorio — [www.fosorio.com](https://www.fosorio.com) — ing.fredyosorio@gmail.com
GitHub: [@fr3dyos](https://github.com/fr3dyos)

## Tech Stack
- Backend: Python 3.11+ / FastAPI
- Database: PostgreSQL via Supabase
- Frontend: Next.js 14 (App Router) + React + TypeScript
- Styling: Plain CSS with custom design tokens (`globals.css` + per-component classes)
- Auth: Supabase Auth (role-based: admin / scorekeeper / public)
- Realtime: Supabase Realtime (live game events)
- i18n: custom JSON dictionary (`messages/{en,es,pt-BR}.json`) + URL locale segment
- Deployment: Coolify (self-hosted PaaS)

## Features
- **Public site**: tournament browser, brackets, leaderboards, player & team profiles, rankings
- **Admin panel**: tournament CRUD, bracket & round-robin generation, field/schedule management
- **Live scoring console**: scorer/assistant/defender selection, substitutions, timeouts, halves, undo-last-event, time/score limit rules
- **Public statistics**: tournament brackets, team rankings, player leaderboards, sortable + CSV-exportable leaderboards
- **Cross-tournament player history lookup**
- **Multi-language**: English, Português (BR), Español
- **Light / dark mode**
- **Role-gated routes**: `/admin`, `/teams`, `/players`, `/games`, `/tournaments` require authentication (`?error=auth` bounce for anonymous); `/` and `/rankings` stay public

## Project Structure
```
powerstats/
├── main.py              # FastAPI app entry point (uvicorn main:app)
├── database.py          # SQLAlchemy engine & session (loads .env via python-dotenv)
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic V1 schemas
├── routers/             # FastAPI route handlers
│   ├── __init__.py
│   ├── deps.py          # Shared dependencies (DB session, Supabase clients)
│   ├── auth.py          # Supabase Auth + role checks
│   ├── tournaments.py   # CRUD + bracket/round-robin/schedule generation
│   ├── teams.py         # CRUD + logo upload
│   ├── players.py       # CRUD + photo upload + cross-tournament stats
│   └── games.py         # Live scoring events, timeouts, halves, game end, undo
├── requirements.txt     # Python backend dependencies
├── app/                 # Next.js 14 frontend (App Router)
│   ├── layout.tsx       # Root layout — wraps every page with TopBar + providers
│   ├── page.tsx         # Home page (public)
│   ├── globals.css      # Global styles + design tokens
│   ├── _components/     # AppShell, TopBar, SignOutButton, I18nProvider, ThemeProvider, etc.
│   ├── admin/           # Role-gated admin surface (tournaments, teams, players, games, login)
│   ├── api/             # Next.js proxy routes → FastAPI (auth + cookie-to-Bearer translation)
│   ├── games/           # Public match-center + index
│   ├── players/         # Public player directory + per-player profile
│   ├── rankings/        # Cross-tournament leaderboards w/ filter + CSV export
│   ├── teams/           # Public team directory + per-team profile
│   ├── tournaments/     # Public tournament list + hub + bracket + public stats
│   ├── forgot-password/ # Password reset request
│   └── reset-password/  # Password reset confirm
├── middleware.ts        # Next.js middleware: Supabase session refresh + protected-route gate
├── next.config.js       # Next.js config
├── messages/            # i18n dictionaries: en.json, es.json, pt-BR.json
├── supabase/            # SQL migrations applied via Supabase CLI or MCP
├── utils/
│   ├── api.ts           # Server-only REST client (translates Supabase cookie → Bearer)
│   ├── api-shared.ts    # Client-safe types, formatters, color helpers (no next/headers)
│   ├── apiClient.ts     # Browser-side fetch wrapper + typed resource helpers
│   ├── i18n.ts          # Locale constants + dictionary lookup
│   ├── i18n-server.ts   # Server-side locale resolution
│   └── supabase/        # Supabase client utilities (client / server / middleware)
├── RUN.md               # Local run + test instructions
└── powerstats-pipeline.md  # Build pipeline documentation
```

## Architecture at a Glance

- **Frontend** (Next.js) renders pages server-side, hydrates with React for interactive pieces (live scoring console, filters, CSV exports).
- **Next.js middleware** (`middleware.ts`) refreshes the Supabase session and gates `/admin`, `/teams`, `/players`, `/games`, `/tournaments` — anonymous traffic is redirected to `/?error=auth`.
- **API proxy routes** (`app/api/**/route.ts`) translate the Supabase session cookie into a `Bearer` token and forward to the FastAPI backend. The browser never talks to FastAPI directly.
- **FastAPI backend** owns the data model, role checks (`require_admin` / `require_scorekeeper`), and all write paths.
- **Supabase** provides Postgres, Auth, and Realtime.

## Local Development

See **[RUN.md](RUN.md)** for the full step-by-step guide.

### Backend
```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # fill in real Supabase + DB values
python -m uvicorn main:app --reload --port 8000
```

The main file to run is **`main.py`** (start with `uvicorn main:app`). The API
is served at `http://localhost:8000` with interactive docs at `/docs`.

### Backend Environment Variables
The following variables must be set in the backend `.env` file:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (backend operations)
- `SUPABASE_ANON_KEY`: Supabase anonymous key (client-side auth)
- `DATABASE_URL`: Supabase Postgres connection string (SQLAlchemy)

### Frontend
```bash
npm install
cp .env.example .env.local  # fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

### Frontend Environment Variables
Set in `frontend/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key (new) **or** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy)
- `NEXT_PUBLIC_API_URL` (optional): override the FastAPI base URL (defaults to `http://localhost:8000`)

### Database migrations
SQL migrations live in `supabase/migrations/`. Apply them with the Supabase
CLI against a linked project:
```bash
supabase db push
```

## Roles & Access

| Route | Public | Scorekeeper | Admin |
|---|---|---|---|
| `/`, `/rankings`, `/tournaments`, `/teams`, `/players`, `/games` read paths | ✅ | ✅ | ✅ |
| `/admin/*` (dashboard, CRUD, live scoring) | — | ✅ | ✅ |
| Bulk delete / photo upload / logo upload | — | — | ✅ (where enforced) |

## Scripts

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npx tsc --noEmit` — typecheck without emitting

## License
MIT
