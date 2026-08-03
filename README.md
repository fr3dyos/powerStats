# PowerStats 🥏

Ultimate Frisbee tournament statistics manager — live scoring, brackets,
round-robin scheduling, and player/team analytics.

## Author
Fredy Osorio — [www.fosorio.com](https://www.fosorio.com) — ing.fredyosorio@gmail.com
GitHub: [@fr3dyos](https://github.com/fr3dyos)

## Tech Stack
- Backend: Python 3.11+ / FastAPI
- Database: PostgreSQL via Supabase
- Frontend: Next.js (React) + TailwindCSS + i18next
- Auth: Supabase Auth (role-based: admin / scorekeeper / public)
- Realtime: Supabase Realtime (live game events)
- Deployment: Coolify (self-hosted PaaS)

## Features
- Admin panel: tournament CRUD, bracket & round-robin generation, field/schedule management
- Live scoring console: scorer/assistant/defender selection, timeouts, halves, time/score limit rules
- Public statistics: tournament brackets, team rankings, player leaderboards, team performance charts
- Cross-tournament player history lookup
- Multi-language: English, Português (BR), Español
- Dark mode

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
│   └── games.py         # Live scoring events, timeouts, halves, game end
├── requirements.txt     # Python backend dependencies
├── app/                 # Next.js frontend
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── middleware.ts        # Root Next.js middleware (Supabase session refresh)
├── next.config.js       # Next.js config
├── utils/supabase/      # Supabase client utilities (client / server / middleware)
├── RUN.md               # Local run + test instructions
├── en.json / es.json / pt-BR.json  # i18n translation files
└── powerstats-pipeline.md  # Build pipeline documentation
```

## Local Development

### Quick Start
See **[RUN.md](RUN.md)** for the full, step-by-step local run/test guide.

### Backend
```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # fill in real Supabase values
python -m uvicorn main:app --reload --port 8000
```

The main file to run is **`main.py`** (start with `uvicorn main:app`). The API
is served at `http://localhost:8000` with interactive docs at `/docs`.

### Backend Environment Variables
The following variables must be set in the backend `.env` file:
- `SUPABASE_URL`: The Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: The Supabase service role key (for backend operations)
- `SUPABASE_ANON_KEY`: The Supabase anonymous key (for client-side auth)
- `DATABASE_URL`: The Supabase Postgres connection string (SQLAlchemy)

### Frontend
```bash
npm install
cp .env.example .env.local  # fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## License
MIT
