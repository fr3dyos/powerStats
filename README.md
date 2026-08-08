# PowerStats 🥏

Ultimate Frisbee tournament statistics manager — live scoring, brackets,
round-robin scheduling, and player/team analytics.

## Author
Fredy Osorio — [www.fosorio.com](https://www.fosorio.com) — ing.fredyosorio@gmail.com
GitHub: [@fr3dyos](https://github.com/fr3dyos)

## Tech Stack
- **Backend**: Python 3.11+ / FastAPI
- **Database**: PostgreSQL via Supabase (RLS enabled with public read policies)
- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Styling**: Plain CSS with custom design tokens (`globals.css` + per-component classes)
- **Auth**: Supabase Auth (role-based: admin / scorekeeper / public)
- **Realtime**: Supabase Realtime (live game events)
- **i18n**: custom JSON dictionary (`messages/{en,es,pt-BR}.json`) + URL locale segment
- **Deployment**: Coolify (self-hosted PaaS)

## Features

### Public Site
- Tournament browser with search and filters
- Interactive brackets with game results
- Player and team profiles with cross-tournament history
- Live game tracking and event streams
- Sortable leaderboards (teams/players) with CSV export and year filter
- Multi-language support (English, Spanish, Portuguese)
- Light/dark theme

### Admin Panel
- Tournament CRUD with phase management
- Bracket and round-robin generation + schedule suggestions
- Field and schedule management
- Team and player management with photo/logo uploads
- Live scoring console with full event tracking
- Roster and spirit-score import from Excel/CSV (via `/roster`, `/spirit/import`)

### Live Scoring Console
- Goal, assist, and defense recording
- Timeout management (max 2 per team per half)
- Half advancement tracking
- Game end by time or score limit
- Undo last event functionality
- Real-time score updates with live/chronometer clock

### Tournament Management
- Multi-phase tournaments (round-robin → bracket)
- Automatic group splitting with snake distribution
- Standings computation with configurable tiebreakers
- Phase advancement (top teams from groups to bracket)
- Spirit of the Game rankings

### Statistics & Analytics
- Cross-tournament player statistics aggregation
- Team win/loss records and power scores
- Per-game and per-tournament breakdowns
- CSV export for all leaderboard data

## Project Structure
```
powerstats/
├── main.py              # FastAPI app entry point (mounts all routers)
├── database.py          # SQLAlchemy engine & session
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic schemas
├── routers/             # FastAPI route handlers
│   ├── auth.py          # Supabase Auth + role checks
│   ├── tournaments.py   # CRUD + phases/groups/standings/bracket/schedule
│   ├── teams.py         # CRUD + logo upload
│   ├── players.py       # CRUD + photo upload + stats
│   ├── games.py         # Live scoring events + batch creation
│   ├── admin.py         # Admin CRUD + roster/spirit import + health
│   └── deps.py          # Shared auth dependencies
├── requirements.txt     # Python dependencies
├── app/                 # Next.js 14 frontend
│   ├── layout.tsx       # Root layout (theme + i18n providers)
│   ├── page.tsx         # Home page (public)
│   ├── globals.css      # Global styles + design tokens
│   ├── _components/     # Shared components (AppShell, providers, toggles)
│   ├── admin/           # Admin panel (dashboard, teams, players, tournaments, games)
│   ├── api/             # Next.js API proxy routes → FastAPI
│   ├── games/           # Public match center + game detail
│   ├── players/         # Player profiles
│   ├── rankings/        # Cross-tournament leaderboards (CSV export)
│   ├── teams/           # Team directory + profiles
│   └── tournaments/     # Tournament hub, bracket, public leaderboard
├── middleware.ts        # Supabase session refresh + auth gate
├── messages/            # i18n dictionaries (en/es/pt-BR)
├── supabase/migrations/ # SQL migrations (apply via `supabase db push`)
├── scripts/             # Seed scripts (e.g. seed_hatrio40.py) + SQL utilities
├── utils/               # API client, Supabase clients, i18n + async helpers
├── PAGE_MAP.md          # Page-by-page audit (tables, endpoints, pages, gaps)
└── next.config.js       # Next.js configuration
```

## Architecture

### Frontend (Next.js)
- Server-side rendering with React hydration
- Middleware handles Supabase session refresh and route protection
- API proxy routes translate cookies to Bearer tokens for FastAPI
- Client components for interactive features (live scoring, filters)

### Backend (FastAPI)
- RESTful API with role-based access control
- SQLAlchemy ORM with proper relationships and cascades
- Direct PostgreSQL connection to Supabase (writes bypass PostgREST/RLS)
- Supabase integration for Auth, Storage, and Realtime
- Comprehensive error handling and validation

### Database Schema
- **tournaments**: Tournament metadata and dates
- **teams**: Teams with tournament association
- **players**: Player profiles with team assignment
- **games**: Match records with scores, rules, and clock columns (`is_live`, `clock_running`, `clock_started_at`, `clock_elapsed`)
- **game_events**: Live scoring events (goals, assists, defenses, timeouts, halves)
- **phases**: Tournament phases (round-robin, bracket)
- **groups**: Group assignments within phases
- **group_teams**: Group ↔ team join table
- **player_tournament_stats**: Aggregated player statistics
- **spirit_scores**: Spirit of the Game ratings
- **token_rules** / **token_transactions**: Token economy rules and ledger
- **Views**: `player_token_balances`, `team_token_balances` (read-only, no SECURITY DEFINER)

All 12 tables have **RLS enabled** with public read policies. Writes go through
the FastAPI backend's direct PostgreSQL connection, which is unaffected by RLS.

### Authentication & Authorization
Three roles with escalating permissions:
- **public**: Browse tournaments, view stats, export data
- **scorekeeper**: All public + live scoring console
- **admin**: All scorekeeper + CRUD operations, bulk actions

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account with project setup

### Backend Setup
```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # Fill in Supabase credentials
python -m uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000` with interactive docs at `/docs`.

### Backend Environment Variables
```
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=your-postgres-connection-string
SUPABASE_DB_URL=your-postgres-connection-string   # fallback, same as DATABASE_URL
SUPABASE_STORAGE_BUCKET=team-logos                # Storage bucket for uploads
```

### Frontend Setup
```bash
npm install
cp .env.example .env.local  # Fill in Supabase credentials
npm run dev
```

Frontend runs at `http://localhost:3000`.

### Frontend Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_API_URL=http://localhost:8000  # Optional
```

### Database Migrations
SQL migrations in `supabase/migrations/` can be applied via Supabase CLI:
```bash
supabase db push
```

## API Endpoints

### Public Endpoints
- `GET /tournaments` - List tournaments
- `GET /tournaments/{id}` - Tournament details with teams
- `GET /tournaments/{id}/phases` - Tournament phases
- `GET /tournaments/{id}/spirit-ranking` - Spirit of the Game rankings
- `GET /phases/{id}` - Phase details with groups
- `GET /phases/{id}/standings` - Standings table
- `GET /teams` - List teams (filter by tournament)
- `GET /teams/{id}` - Team details with players
- `GET /players` - List players (filter by team)
- `GET /players/{id}` - Player profile with events
- `GET /players/{id}/stats` - Cross-tournament stats
- `GET /games` - List games (filter by tournament)
- `GET /games/{id}` - Game details with events
- `GET /games/{id}/events` - Game event stream
- `GET /auth/me` - Current user profile
- `GET /admin/health` - Health check

### Auth Endpoints
- `POST /auth/register` - Create account
- `POST /auth/login` - Sign in
- `POST /auth/logout` - Sign out
- `GET /auth/users` - List users (admin)
- `PUT /auth/users/{id}/role` - Update user role (admin)

### Scorekeeper Endpoints
- `POST /games` - Create game
- `POST /games/batch` - Bulk create games
- `PUT /games/{id}` - Update game
- `POST /games/{id}/events` - Record scoring event
- `POST /games/{id}/timeout` - Start timeout
- `POST /games/{id}/end-timeout` - End timeout
- `POST /games/{id}/advance-half` - Advance to next half
- `POST /games/{id}/end` - End game
- `POST /tournaments/{id}/bracket` - Generate bracket
- `POST /tournaments/{id}/round-robin` - Generate fixtures
- `POST /tournaments/{id}/schedule-suggestion` - Suggest schedule
- `POST /tournaments/{id}/phases` - Create phase
- `POST /phases/{id}/groups/split` - Auto-split groups
- `POST /phases/{id}/round-robin` - Round-robin within phase
- `POST /phases/{id}/bracket` - Bracket within phase
- `POST /phases/{id}/advance` - Advance teams to next phase
- `PUT /phases/{id}` - Update phase

### Admin Endpoints
- `POST /tournaments` - Create tournament
- `PUT /tournaments/{id}` - Update tournament
- `DELETE /tournaments/{id}` - Delete tournament
- `POST /teams` - Create team
- `PUT /teams/{id}` - Update team
- `DELETE /teams/{id}` - Delete team
- `POST /teams/{id}/logo` - Upload team logo
- `POST /players` - Create player
- `PUT /players/{id}` - Update player
- `DELETE /players/{id}` - Delete player
- `POST /players/{id}/photo` - Upload player photo
- `DELETE /games/{id}` - Delete game
- `DELETE /phases/{id}` - Delete phase
- `POST /tournaments/{id}/roster` - Import team roster
- `POST /tournaments/{id}/roster/import` - Bulk roster import
- `POST /tournaments/{id}/spirit/import` - Import spirit scores

## Role-Based Access

| Route | Public | Scorekeeper | Admin |
|---|---|---|---|
| `/`, `/rankings`, read paths | ✅ | ✅ | ✅ |
| `/admin/*` | — | ✅ | ✅ |
| Live scoring console | — | ✅ | ✅ |
| CRUD / bulk import / user management | — | — | ✅ |

## Scripts

- `npm run dev` — Start Next.js dev server
- `npm run build` — Production build
- `npm run start` — Run production build
- `npx tsc --noEmit` — Typecheck without emitting
- `python -m uvicorn main:app --reload --port 8000` — Start FastAPI backend
- `python scripts/seed_hatrio40.py` — Seed a tournament from an Excel file (see script header for `EXCEL_PATH`)

## Internationalization

Supported languages:
- English (en)
- Spanish (es)
- Portuguese - Brazil (pt-BR)

Translation files are in `messages/` directory. Add new languages by creating a new JSON file and updating the `LOCALES` constant in `utils/i18n.ts`.

## Page Map

See [PAGE_MAP.md](PAGE_MAP.md) for a comprehensive page-by-page audit: every
database table, API endpoint, and frontend page with its current status,
buttons, functions, and known gaps.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License
MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/fr3dyos/powerStats/issues).

For questions, contact: ing.fredyosorio@gmail.com
