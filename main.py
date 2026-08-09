"""PowerStats FastAPI application entry point.

This module creates the FastAPI app, configures CORS, and registers all
API routers. It also provides a root health endpoint for uptime checks.

Environment variables (read from .env or shell):
- DATABASE_URL or SUPABASE_DB_URL: Postgres connection string
- SUPABASE_URL: Supabase project URL
- SUPABASE_ANON_KEY: Public anon key for client-side auth
- SUPABASE_SERVICE_ROLE_KEY: Service role key for admin operations (server-only)
"""

# Apply supabase-py compatibility patch (accepts sb_* format keys) before any
# supabase imports so the monkey-patch is in place for all subsequent usage.
import compat  # noqa: F401

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admin, auth, games, players, teams, tournaments

app = FastAPI(
    title="PowerStats API",
    description="Tournament and live-scoring management for Ultimate Frisbee",
    version="1.0.0",
)

# CORS: allow the Next.js dev server and production frontend.
# In production, replace "*" with your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(tournaments.router)
app.include_router(tournaments.phases_router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(games.router)
app.include_router(admin.router)


@app.get("/")
def root() -> dict:
    """Root health check.

    :return: Static status payload.
    """
    return {"status": "ok", "service": "PowerStats API"}


@app.get("/health")
def health() -> dict:
    """Liveness probe for load balancers / uptime monitors.

    :return: Static status payload.
    """
    return {"status": "healthy"}
