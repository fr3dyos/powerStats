# PowerStats 🥏

Ultimate Frisbee tournament statistics manager — live scoring, brackets,
round-robin scheduling, and player/team analytics.

## Author
Fredy Osorio — [www.fosorio.com](https://www.fosorio.com) — ing.fredyosorio@gmail.com
GitHub: [@fr3dyos](https://github.com/fr3dyos)

## Tech Stack
- Backend: Python 3.11+ / FastAPI
- Database: PostgreSQL via Supabase
- Frontend: React + Vite + TailwindCSS + i18next
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
├── database.py         # SQLAlchemy engine & session
├── models.py           # SQLAlchemy ORM models
├── schemas.py          # Pydantic V1 schemas
├── routers/            # FastAPI route handlers
│   ├── __init__.py
│   ├── auth.py         # Supabase Auth + role checks
│   ├── deps.py         # Shared dependencies
│   ├── tournaments.py  # CRUD + bracket/round-robin generation
│   ├── teams.py        # CRUD + logo upload
│   ├── players.py      # CRUD + photo upload + cross-tournament stats
│   └── games.py        # Live scoring events, timeouts, halves, game end
├── requirements.txt    # Python backend dependencies
├── app/                # Next.js frontend
├── utils/              # Supabase client utilities
├── en.json             # English i18n
├── es.json             # Spanish i18n
├── pt-BR.json          # Portuguese (Brazil) i18n
└── powerstats-pipeline.md  # Build pipeline documentation
```

## Local Development

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # fill in real Supabase values
uvicorn main:app --reload --port 8000
```

### Backend Environment Variables
The following variables must be set in the backend `.env` file:
- `SUPABASE_URL`: The Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: The Supabase service role key (for backend operations)
- `SUPABASE_ANON_KEY`: The Supabase anonymous key (for client-side auth)

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## License
MIT
