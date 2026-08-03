"""PowerStats FastAPI application entry point.

Run with::

    uvicorn main:app --reload --port 8000

This module wires up the SQLAlchemy models, all API routers, CORS, and a
couple of lightweight health/liveness endpoints.
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models
from database import Base, engine
from routers import admin, auth, deps, games, players, teams, tournaments

logger = logging.getLogger("powerstats")

# Load environment variables from `.env` before anything reads them,
# e.g. CORS_ORIGINS and the Supabase credentials used by deps.py / auth.py.
load_dotenv()

# Create tables if they do not exist yet (dev convenience). In production
# prefer SQLAlchemy migrations (Alembic) against the Supabase Postgres DB.
# This is wrapped in a try/except so the server can still boot (health/docs)
# if the database is temporarily unreachable; DB-backed endpoints will fail
# with a clear error when they are actually called.
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables are ready.")
except Exception as exc:  # pragma: no cover - depends on DB availability
    logger.warning(
        "Could not create/verify database tables at startup: %s. "
        "The app will start, but DB-backed endpoints may fail until the "
        "database is reachable.",
        exc,
    )

app = FastAPI(
    title="PowerStats API",
    description=(
        "Ultimate Frisbee tournament statistics manager — live scoring, "
        "brackets, round-robin scheduling, and player/team analytics."
    ),
    version="1.0.0",
)

# CORS: allow the local frontend dev server (and any other configured origin).
# In production, restrict ``allowed_origins`` to the actual frontend domain.
allowed_origins = [
    origin
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers.
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(tournaments.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(games.router)


@app.get("/", tags=["meta"])
def root() -> dict:
    """Basic root endpoint returning API metadata."""
    return {
        "app": "PowerStats API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Liveness/health check endpoint."""
    return {"status": "ok"}
