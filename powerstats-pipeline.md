# PowerStats — WebApp Build Pipeline ("Webapps for Dummies" #1)

**Author:** Fredy Osorio — [www.fosorio.com](https://www.fosorio.com) — ing.fredyosorio@gmail.com
**GitHub:** https://github.com/fr3dyos
**Project:** PowerStats — Ultimate Frisbee Tournament Statistics Manager
**Stack decision:** Python backend (FastAPI), Postgres via Supabase, deploy via Coolify, multi-language (EN/PT-BR/ES), dark mode.

> This document is a reusable, step-by-step pipeline for building any AI-assisted web app. Save it as your personal template.

---

## 0. Assumptions & Stack Choices (stated up front, no guessing)

| Decision | Choice | Why |
|---|---|---|
| Backend | Python + FastAPI | Matches your Python preference, async-friendly for live scores, auto-generates OpenAPI docs [web:6] |
| Frontend | React (Vite) + TailwindCSS + i18next | Component reuse for admin/public views, easy dark mode + 3-language support |
| Database | PostgreSQL via Supabase | Free tier: 500MB DB, 1GB storage, 50k MAU, built-in Auth and Row Level Security [web:1][web:3][web:4] |
| Realtime scores | Supabase Realtime (WebSockets) | Live game stats without building your own socket server |
| Auth | Supabase Auth (email/password) | Built-in admin/user roles, no custom auth code needed [web:7] |
| Hosting | Coolify (self-hosted PaaS on a VPS) | Free, Docker-based, Git-integrated auto-deploy, free SSL [web:6][web:11] |
| Version control | GitHub (fr3dyos) | Conventional Commits, PR-based workflow |
| UI mockups | Google Stitch (Gemini-based) | Fast AI-generated UI screens exportable to HTML/CSS/Figma [web:2][web:10][web:14] |

**Gaps you should confirm before Phase 1** (use reasonable defaults below if you skip):
1. Do you want a single combined FastAPI+React repo (monorepo) or two repos? → Default: **monorepo** (`/backend`, `/frontend`).
2. VPS provider for Coolify (Hetzner, DigitalOcean, Contabo)? → Default: any €5–6/mo VPS, 2GB RAM minimum.
3. Domain registrar? → Default: Namecheap or Porkbun (buy after Phase 6).

---

## 1. AI Tool Role Assignment

Different AI tools are strong at different tasks. Don't use one AI for everything — this saves tokens and improves output quality.

| Task | Best AI Tool | Why |
|---|---|---|
| Architecture planning, DB schema, full pipeline docs | **Claude (Opus/Sonnet)** | Best long-context reasoning, structured technical writing |
| Bulk code generation (backend routes, models, CRUD) | **Blackbox AI** | Fast multi-file code generation, good at boilerplate |
| Debugging, code review, refactor explanations | **Claude** | Best at reasoning about *why* something breaks |
| Quick syntax lookups, small snippets, translations (i18n JSON) | **ChatGPT** | Fast, cheap, good at short isolated tasks |
| Research (best library, comparing tools, Supabase/Coolify docs) | **Perplexity** | Live web search with citations, avoids hallucinated library versions |
| UI screen mockups (visual layout only, not code) | **Google Stitch** | Purpose-built AI UI generator, exports HTML/CSS/Figma [web:10] |
| Final integration check / "does everything work together" | **Claude** | Best at holistic multi-file consistency checks |

**Token-saving rule for Claude:** Never paste the whole repo. Paste only the relevant file(s) + a one-line description of the folder structure. Ask Claude to output **diffs or full replacement files**, not explanations, unless you explicitly ask "explain."

---

## 2. Project Planning (Do this on paper/Notion first)

Data entities needed:
- `tournaments` (name, logo, dates, format: bracket/round-robin, field_count, scoring_rule: time_limit | score_limit, limit_value)
- `teams` (name, logo, tournament_id, gender_category)
- `players` (name, nickname, jersey_number, team_id, origin_city, photo)
- `games` (tournament_id, team_a_id, team_b_id, field_number, scheduled_time, status, half, timeouts_a, timeouts_b)
- `game_events` (game_id, player_id, event_type: goal|assist|defense|turnover, timestamp, scorer_user_id, assistant_user_id)
- `player_tournament_stats` (player_id, tournament_id, goals, assists, defenses, mvp_points) — aggregated view
- `users` (admin/scorekeeper roles via Supabase Auth + custom `role` claim)

This schema lets a player's historical cross-tournament stats be queried by `player_id` across all `player_tournament_stats` rows — solving your "load player info from other tournaments" requirement.

---

## 3. Step-by-Step Pipeline

### Phase 1 — Repository Setup (do this yourself, 10 minutes)

```bash
# 1. Create the project folder
mkdir powerstats && cd powerstats

# 2. Initialize git
git init

# 3. Create folder structure
mkdir -p backend frontend docs

# 4. Create and checkout main branch explicitly
git branch -M main

# 5. Create remote repo on GitHub (via CLI, requires gh installed)
gh repo create fr3dyos/powerstats --public --source=. --remote=origin

# 6. First commit
git add .
git commit -m "chore: initialize powerstats repository structure"
git push -u origin main
```

If you don't have `gh` CLI: create the repo manually at github.com/new under `fr3dyos`, then:
```bash
git remote add origin https://github.com/fr3dyos/powerstats.git
git push -u origin main
```

### Phase 2 — `.gitignore`

Create `.gitignore` in repo root:

```
# Python
__pycache__/
*.pyc
.venv/
venv/
*.egg-info/

# Node / React
node_modules/
dist/
build/
.vite/

# Env & secrets
.env
.env.local
.env.*.local
*.pem

# Supabase
.supabase/

# OS
.DS_Store
Thumbs.db

# Editors
.vscode/
.idea/

# Logs
*.log
npm-debug.log*

# Coolify/Docker
*.override.yml
```

### Phase 3 — `README.md`

Create `README.md` at root with this content (edit placeholders as your project evolves):

```markdown
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
- Public statistics: tournament brackets, team rankings, player leaderboards (M/F), team performance charts
- Cross-tournament player history lookup
- Multi-language: English, Português (BR), Español
- Dark mode

## Project Structure
```
powerstats/
├── backend/       # FastAPI app
├── frontend/      # React app
├── docs/          # Architecture & schema docs
└── .github/       # CI/CD workflows
```

## Local Development
See "Run Locally" section below.

## License
MIT
```

### Phase 4 — Supabase Setup

1. Go to supabase.com → sign up with GitHub → **New Project** → set project name `powerstats`, a strong DB password, region closest to your users [web:1][web:4].
2. Wait ~2 minutes for provisioning [web:7].
3. Copy from **Project Settings → API**: `Project URL`, `anon public key`, `service_role key` (keep secret).
4. Copy from **Project Settings → Database**: the **Session pooler** connection string for backend use [web:12].
5. Store all of these in a local `.env` file (never commit it — it's in `.gitignore` already).

`.env.example` (commit this one, without real values):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[pooler-host]:5432/postgres
JWT_SECRET=
ENV=development
```

### Phase 5 — AI-Assisted Coding Prompts

Use these prompts **in order**. Copy-paste exactly, then insert your own repo context where marked `<<>>`.

#### 5.1 Claude — Architecture & Schema Generation (use Claude first, it's the planner)

```
You are a senior full-stack architect. I am building "PowerStats," a Python
(FastAPI) + PostgreSQL (Supabase) + React web app for managing Ultimate
Frisbee tournament statistics. I am a junior programmer — explain nothing
extra, just output files.

Context:
- Backend: FastAPI, SQLAlchemy, Supabase Postgres via connection pooler.
- Auth: Supabase Auth with roles: admin, scorekeeper, public.
- Entities: tournaments, teams, players, games, game_events,
  player_tournament_stats.
- Requirements: tournament CRUD, bracket generation, round-robin generation,
  schedule suggestion by field count, player stats aggregation across
  tournaments, live game scoring (scorer/assistant/defender selection,
  timeouts, halves, time-limit OR score-limit game rules), image upload for
  tournament/team/player logos.

Task: Generate the SQLAlchemy models (models.py), Pydantic schemas
(schemas.py), and a database.py connection module for FastAPI + Supabase
Postgres. Follow PEP 8. Include docstrings with parameter/return types and
units where relevant. Do not include explanations, only code blocks with
filenames as headers.
```

#### 5.2 Blackbox AI — Bulk Route Generation (fast, cheap, good at CRUD boilerplate)

```
Using the SQLAlchemy models and Pydantic schemas below <<read @models.py and
@schemas.py files>>, generate FastAPI router files for:
1. routers/tournaments.py — CRUD + bracket generation endpoint + round-robin
   generation endpoint + schedule suggestion endpoint (accepts field_count).
2. routers/teams.py — CRUD, logo upload to Supabase Storage.
3. routers/players.py — CRUD, logo upload, endpoint to fetch a player's
   stats across ALL tournaments by player_id.
4. routers/games.py — live scoring endpoints: record goal/assist/defense
   event, start/end timeout, advance half, end game by time_limit or
   score_limit rule.
5. routers/auth.py — Supabase Auth integration with role check dependency
   (admin, scorekeeper, public).

Follow PEP 8, include try/except error handling, no hardcoded secrets
(use os.environ). Output full file contents only, filenames as headers.
```

#### 5.3 ChatGPT — i18n JSON translation files (fast, cheap task)

```
Generate three JSON translation files for a React app using i18next:
en.json, pt-BR.json, es.json. Include keys for: navigation labels
(Tournaments, Teams, Players, Rankings, Live Game, Admin, Login, Logout),
admin panel labels (Create Tournament, Generate Bracket, Generate Round
Robin, Manage Fields, Field Count, Scoring Rule, Time Limit, Score Limit,
Upload Logo), live scoring console labels (Scorer, Assistant, Defender,
Timeout, Half 1, Half 2, End Game), and public stats labels (Goals,
Assists, Defenses, MVP, Team Ranking, Last 5 Games, Break Goals, Goal
Average, Defense Average, Men's Stats, Women's Stats). Keep keys identical
across all three files, only translate values. Output only the three JSON
code blocks.
```

#### 5.4 Google Stitch — UI Visual Mockup Prompts

Go to https://stitch.withgoogle.com, sign in, choose **Web**, and paste each prompt separately per screen [web:10][web:15]. Use the 3-layer + Zoom-Out-Zoom-In structure (Context → Description → Platform → Visual style → Components) [web:8][web:9]:

**Admin Dashboard screen:**
```
Context: Admin dashboard for "PowerStats," an Ultimate Frisbee tournament
management web app.
Description: Admin needs to see a list of active tournaments, quick stats
(number of teams, fields in use, games today), and buttons to create a new
tournament, generate a bracket, or generate a round-robin schedule. Content
priority: tournament list first, quick actions second.
Platform: Responsive web dashboard, desktop-first, supports dark mode.
Visual style: Sporty, energetic, modern SaaS feel. Bold sans-serif
typography, high contrast, disc/frisbee-inspired accent shapes, primary
color deep orange/teal, dark mode with near-black background and neon
accent highlights. WCAG AA contrast compliant.
UI components: Top nav with PowerStats logo placeholder + dark mode toggle
+ language switcher (EN/PT-BR/ES), left sidebar (Tournaments, Teams,
Players, Live Game, Settings), main area with tournament cards showing
logo, name, date, status badge, and a floating "+ New Tournament" button.
```

**Live Scoring Console screen:**
```
Context: Live game scoring console for a scorekeeper managing an Ultimate
Frisbee match in real time.
Description: Scorekeeper must select scorer, assistant, and defending
player for each point, track timeouts per team, toggle half 1/half 2, and
see current score updating live. Must work fast under time pressure during
a live game.
Platform: Responsive web app, optimized for tablet use on the sideline,
dark mode default (outdoor glare).
Visual style: Sporty, bold, large touch targets, high-contrast scoreboard
typography, minimal clutter, deep orange/teal accent on dark background.
UI components: Large scoreboard header (Team A vs Team B with live score
and half indicator), two player-selection dropdowns/searchable lists
(scorer, assistant), one defender selection list, timeout buttons per team
with remaining-timeout counters, "End Game" button that respects
time-limit or score-limit rule, undo-last-event button.
```

**Public Player/Team Stats screen:**
```
Context: Public statistics page for "PowerStats" showing team performance
and player rankings.
Description: Visitors compare teams via charts (break goals, goal average
per game, defense average per game, last 5 game results) and browse
sortable player leaderboard tables split by gender (goals, assists,
defenses, MVP points).
Platform: Responsive public web page, desktop and mobile, dark mode
toggle.
Visual style: Sporty, clean data-dense sports-analytics aesthetic (like
ESPN stat pages), bold headline font for scores, readable table font, deep
orange/teal accents, dark mode with card-based sections.
UI components: Team profile header (logo, name, record), horizontal bar
chart for goal/defense averages, line chart for last-5-games trend, sortable
leaderboard table with gender toggle tabs (Men/Women), MVP badge icons.
```

After Stitch generates each screen, click the **code icon → Copy code** to get exportable HTML/CSS, and hand that off to Claude/Blackbox as a visual reference when generating the actual React components [web:10].

#### 5.5 Perplexity — Research/Validation Prompts

Use Perplexity whenever Claude/Blackbox suggests a library or approach you're unsure about:

```
What is the current best-practice way (2026) to implement round-robin and
single/double-elimination bracket generation algorithms in Python for a
sports tournament app? Compare libraries vs. writing custom logic, and cite
sources.
```

```
What is the current recommended way (2026) to set up Supabase Realtime
subscriptions in a React app for live-updating data (e.g., live sports
scores)? Include code example and cite official docs.
```

#### 5.6 Claude — Full Integration Check Prompt

Run this **after** all files are generated, before deployment:

```
I am integrating multiple AI-generated files into one FastAPI + React +
Supabase project called PowerStats. Below is my current file tree and the
contents of each file << read the file tree and all backend files >>.

Task:
1. Check for inconsistencies between models.py, schemas.py, and the
   routers (mismatched field names, missing imports, wrong types).
2. Check that all Supabase Auth role checks are applied consistently
   across admin-only endpoints.
3. Check that the bracket/round-robin generation logic and schedule
   suggestion logic are internally consistent with the games table schema.
4. List any missing error handling, missing environment variables, or
   security issues (e.g., hardcoded secrets, missing input validation).
5. Output a numbered list of exact fixes needed, then output the corrected
   full files only for files that need changes.

Do not summarize what the code does — only report problems and fixes.

update the file README.md
```

#### 5.7 Local Server Test Commands (run these yourself after AI generates code)

Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env          # then fill in real Supabase values
uvicorn main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
cp .env.example .env.local        # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Test the connection end-to-end:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/tournaments
```

Open `http://localhost:5173` (Vite default) in your browser and confirm the admin login and dashboard load.

#### 5.8 Claude — Final "Everything Works Together" Test Prompt

```
I have a running FastAPI backend on localhost:8000 and a React frontend on
localhost:5173, connected to Supabase Postgres. Generate a pytest test
suite (test_integration.py) that:
1. Spins up the FastAPI app with TestClient.
2. Creates a test tournament, a test team, and a test player via API calls.
3. Generates a round-robin schedule and asserts every team plays every
   other team exactly once.
4. Simulates a live game: records 3 goal events with scorer/assistant/
   defender, advances halves, ends the game by score_limit, and asserts
   final stats aggregate correctly into player_tournament_stats.
5. Asserts role-based access control blocks a "public" role user from
   calling admin-only endpoints (expects 403).

Output the full test file only, using pytest and httpx.TestClient. Include
a requirements-test.txt with pinned versions.
```

Run it locally:
```bash
pip install -r requirements-test.txt
pytest test_integration.py -v
```

### Phase 6 — Git Workflow (Conventional Commits)

```bash
git checkout -b feat/tournament-crud
# ... make changes ...
git add .
git commit -m "feat: add tournament CRUD endpoints and bracket generation"
git push -u origin feat/tournament-crud
# open a Pull Request on GitHub, merge to main after review
```

Common commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

### Phase 7 — Deployment via Coolify

1. Provision a VPS (2GB RAM minimum) with Docker installed [web:6][web:11].
2. On the VPS, install Coolify:
```bash
mkdir -p /opt/coolify && cd /opt/coolify
curl -fsSL https://coolify.io/install.sh | bash
```
3. Open the Coolify dashboard (shown after install), create an **admin account**.
4. Connect your GitHub account (`fr3dyos`) as a source in Coolify.
5. Create a **New Resource → Application**, select the `powerstats` repo, choose the `backend` folder as one service (FastAPI, Dockerfile-based) and `frontend` as another (static build).
6. Add environment variables (Supabase URL, keys, DATABASE_URL) in Coolify's environment tab — never commit them.
7. Set the build command for frontend (`npm run build`) and Coolify's reverse proxy handles HTTPS automatically once you attach a domain [web:6].
8. Point your domain's DNS `A record` to the VPS IP address.
9. In Coolify, attach your domain to the application; Coolify provisions free Let's Encrypt SSL automatically.
10. Trigger deploy — Coolify auto-redeploys on every `git push` to `main` if you enable the webhook.

### Phase 8 — Buy & Connect a Domain

1. Purchase a domain (e.g., `powerstats.app` or `powerstats.gg`) via Namecheap, Porkbun, or Google Domains successor registrar.
2. In your registrar's DNS settings, create an `A` record pointing to your VPS IP, and optionally a `CNAME` for `www`.
3. Wait for DNS propagation (5 min–48 hrs).
4. Confirm HTTPS is active by visiting `https://yourdomain.com` — Coolify's Let's Encrypt integration should show a valid certificate.
5. Update your `README.md` with the live URL.

---

## 4. Quick Reference Checklist

- [ ] GitHub repo created under fr3dyos with `.gitignore` and `README.md`
- [ ] Supabase project provisioned, `.env` filled locally (never committed)
- [ ] Claude generated models/schemas
- [ ] Blackbox generated routers
- [ ] ChatGPT generated i18n files (EN/PT-BR/ES)
- [ ] Google Stitch mockups created for Admin, Live Scoring, Public Stats screens
- [ ] Perplexity validated bracket-generation and Realtime approach
- [ ] Local backend + frontend run and connect successfully
- [ ] Claude ran integration check and fixed issues
- [ ] pytest integration suite passes locally
- [ ] Code pushed via feature branch + PR workflow
- [ ] Coolify installed on VPS and app deployed
- [ ] Domain purchased and connected with SSL

---

## 5. Notes on Scope You May Want to Revisit Later

- MVP scoring logic (MVP points formula) is not standardized in Ultimate Frisbee — you'll need to define your own weighting (e.g., goals×2 + assists×1.5 + defenses×1) and tell Claude this formula explicitly when generating the stats aggregation code.
- "Break goals" (goals scored on the opponent's serve) requires tracking which team pulled/served at each point — add a `serving_team_id` field to `game_events` if not already planned.
- Bracket generation algorithms (single/double elimination) are non-trivial — validate with Perplexity before locking in a library.
