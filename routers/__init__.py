"""PowerStats API routers package.

This package contains FastAPI routers for the PowerStats backend:

- tournaments: tournament CRUD, bracket / round-robin generation, schedule suggestions.
- teams: team CRUD and logo uploads to Supabase Storage.
- players: player CRUD, photo uploads, and cross-tournament stats aggregation.
- games: live scoring (events, timeouts, halves) and game lifecycle.
- auth: Supabase Auth integration and role-based access control.

All routers rely on the shared dependencies in ``routers.deps`` and the
SQLAlchemy models / Pydantic schemas at the package root.
"""

