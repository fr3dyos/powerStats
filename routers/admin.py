"""Admin-only FastAPI endpoints.

This module hosts endpoints that must only be reachable by authenticated
Supabase users whose ``app_metadata.role`` equals ``"admin"``. It uses
the shared ``require_admin`` dependency from :mod:`routers.auth` to enforce
that policy at the API layer.

Important: Supabase Row Level Security (RLS) and per-table policies are the
*database-side* authorization control. This dependency is the *API-side*
gate. They must both be enforced for any production mutation — frontend
route guards and this dependency alone are not sufficient.

When you add new admin mutation routes (tournament CRUD, team logos, player
rosters, live scoring events, brackets, schedules), attach
``Depends(require_admin)`` so the existing role check is applied
consistently::

    from routers.auth import require_admin

    @router.post("/tournaments")
    def create_tournament(payload: ..., _: str = Depends(require_admin)):
        ...
"""

from fastapi import APIRouter, Depends

from routers.auth import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/health")
def admin_health(_: str = Depends(require_admin)) -> dict:
    """Liveness probe that is only reachable by verified admins.

    The endpoint returns a small static payload. It exists so that
    infrastructure (and the frontend admin shell) can prove that a valid
    Supabase JWT and the correct ``app_metadata.role`` are present without
    exposing any privileged data.

    :return: ``{"status": "ok", "message": "Admin access verified"}``.
    :raises HTTPException: 401 if the bearer token is missing/invalid;
        403 if the token is valid but the user is not an admin.
    """
    return {"status": "ok", "message": "Admin access verified"}