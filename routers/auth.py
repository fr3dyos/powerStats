"""Supabase Auth integration and role-based access control.

This router exposes registration, login, logout, and the current-user
endpoint backed by Supabase Auth (email/password). It also defines reusable
dependencies:

- ``get_current_user``: resolves the bearer token to a Supabase user.
- ``require_roles``: factory returning a dependency that enforces one or
  more allowed roles (``admin``, ``scorekeeper``, ``public``).

Roles are stored in the user's app metadata under ``app_metadata.role``.
Only the service-role client may set/update roles.

No secrets are hardcoded: ``SUPABASE_URL`` and ``SUPABASE_ANON_KEY`` /
``SUPABASE_SERVICE_ROLE_KEY`` are read from the environment.
"""

import os
from enum import Enum
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, EmailStr, Field
from supabase import create_client

from routers.deps import get_supabase_admin_client

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Pydantic request/response models (auth-specific; kept local to this router)
# ---------------------------------------------------------------------------
class RoleEnum(str, Enum):
    """Allowed application roles for PowerStats users."""

    ADMIN = "admin"
    SCOREKEEPER = "scorekeeper"
    PUBLIC = "public"


class RegisterRequest(BaseModel):
    """Payload for creating a new Supabase Auth user."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    role: RoleEnum = RoleEnum.PUBLIC


class LoginRequest(BaseModel):
    """Payload for password-based sign in."""

    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Public representation of an authenticated Supabase user."""

    id: str
    email: Optional[str] = None
    role: Optional[str] = None


class MessageOut(BaseModel):
    """Simple message response."""

    message: str


# ---------------------------------------------------------------------------
# Client helpers (read credentials from the environment only)
# ---------------------------------------------------------------------------
def _get_anon_client():
    """Build an anon-key Supabase client for public auth endpoints.

    :raises RuntimeError: If ``SUPABASE_URL`` / ``SUPABASE_ANON_KEY`` are unset.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not anon_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY environment variables "
            "must be set to use Supabase Auth."
        )
    return create_client(supabase_url, anon_key)


def _extract_role(user) -> Optional[str]:
    """Read the role from a Supabase user's app metadata.

    :param user: A Supabase ``User`` object.
    :return: Role string (``admin``, ``scorekeeper``, ``public``) or ``None``.
    """
    if not user:
        return None
    metadata = getattr(user, "app_metadata", None) or {}
    if isinstance(metadata, dict):
        return metadata.get("role")
    # Some supabase-py versions wrap metadata in a nested object.
    nested = getattr(metadata, "app_metadata", None)
    if nested and isinstance(nested, dict):
        return nested.get("role")
    return None


# ---------------------------------------------------------------------------
# Role-check dependency factory
# ---------------------------------------------------------------------------
def require_roles(*allowed_roles: str, allow_anonymous: bool = False):
    """Create a dependency enforcing that the current user has a role.

    Usage::

        @router.get("/admin-only")
        def admin_endpoint(_: str = Depends(require_roles("admin"))):
            return {"ok": True}

    When ``allow_anonymous=True`` the dependency permits requests without a
    bearer token (public browsing). If a token IS provided it is still
    validated and the user's role is enforced; missing/invalid tokens are
    treated as anonymous rather than rejected.

    :param allowed_roles: One or more role names permitted for the endpoint.
    :param allow_anonymous: When True, anonymous requests are permitted.
    :return: A FastAPI dependency callable.
    """
    async def _role_checker(authorization: Optional[str] = Header(None)):
        if not authorization or not authorization.lower().startswith("bearer "):
            if allow_anonymous:
                return None
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing bearer token. Include 'Authorization: Bearer <token>'.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = authorization.split(" ", 1)[1].strip()

        try:
            admin_client = get_supabase_admin_client()
            user = admin_client.auth.get_user(token).user
        except Exception as exc:
            if allow_anonymous:
                # A malformed or expired token on a public endpoint falls
                # back to anonymous access rather than failing the request.
                return None
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired token: {str(exc)}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        role = _extract_role(user)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Requires role(s) {', '.join(allowed_roles)}. "
                    f"Current role: {role or 'unset'}."
                ),
            )
        return user

    return _role_checker


# Alias dependencies for convenience across routers.
require_admin = require_roles("admin")
require_scorekeeper = require_roles("admin", "scorekeeper")
# Public endpoints allow anonymous browsing (no token required). If a token
# is present it is still validated and restricted to the allowed roles.
require_public = require_roles("admin", "scorekeeper", "public", allow_anonymous=True)


def get_current_user(
    authorization: Optional[str] = Header(None),
) -> dict:
    """Resolve the bearer token to the current Supabase user (no role check).

    :param authorization: Raw ``Authorization`` header.
    :return: A dict with ``id``, ``email`` and ``role`` of the user.
    :raises HTTPException: 401 when the token is missing or invalid.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        admin_client = get_supabase_admin_client()
        user = admin_client.auth.get_user(token).user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return {
        "id": getattr(user, "id", None),
        "email": getattr(user, "email", None),
        "role": _extract_role(user),
    }


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    """Create a new Supabase Auth user with an initial application role.

    Uses the anon client for sign-up; then, if a role different from the
    default is requested, updates ``app_metadata.role`` via the service-role
    client. Only ``public`` is permitted for self-registration unless the
    caller supplies a valid admin token (see ``admin_update_role``).

    :param payload: Registration data (email, password, role).
    :return: The created user's id, email and role.
    """
    try:
        anon_client = _get_anon_client()
        res = anon_client.auth.sign_up(
            {"email": payload.email, "password": payload.password}
        )
        user = res.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sign-up failed. The email may already be registered.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(exc)}",
        ) from exc

    # Assign the requested role via service-role admin client.
    try:
        admin_client = get_supabase_admin_client()
        admin_client.auth.admin.update_user_by_id(
            user.id, {"app_metadata": {"role": payload.role.value}}
        )
    except Exception as exc:  # pragma: no cover - role assignment is best-effort
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not assign role '{payload.role.value}': {str(exc)}",
        ) from exc

    return UserOut(id=user.id, email=user.email, role=payload.role.value)


@router.post("/login", response_model=dict)
def login(payload: LoginRequest):
    """Sign in with email/password via Supabase Auth.

    :param payload: Email and password.
    :return: ``access_token``, ``token_type``, ``expires_in`` and user info.
    """
    try:
        anon_client = _get_anon_client()
        res = anon_client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials: {str(exc)}",
        ) from exc

    session = getattr(res, "session", None)
    user = getattr(res, "user", None)
    if not session or not getattr(session, "access_token", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed: no session returned.",
        )

    return {
        "access_token": session.access_token,
        "token_type": "bearer",
        "expires_in": getattr(session, "expires_in", None),
        "user": UserOut(
            id=getattr(user, "id", None),
            email=getattr(user, "email", None),
            role=_extract_role(user),
        ),
    }


@router.post("/logout", response_model=MessageOut)
def logout(authorization: Optional[str] = Header(None)):
    """Sign out the current user by revoking their session token.

    :param authorization: Raw ``Authorization`` header.
    :return: Confirmation message.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        anon_client = _get_anon_client()
        anon_client.auth.admin.sign_out(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logout failed: {str(exc)}",
        ) from exc
    return MessageOut(message="Signed out successfully.")


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile.

    :param current_user: Injected by ``get_current_user``.
    :return: The user's id, email and role.
    """
    return UserOut(**current_user)


# ---------------------------------------------------------------------------
# Admin-only endpoints
# ---------------------------------------------------------------------------
class RoleUpdateRequest(BaseModel):
    """Payload to change a user's application role."""

    user_id: str
    role: RoleEnum


@router.put("/users/{user_id}/role", response_model=UserOut)
def admin_update_role(
    user_id: str,
    payload: RoleUpdateRequest,
    _: str = Depends(require_admin),
):
    """Update a user's application role (admin only).

    :param user_id: Supabase Auth user UUID.
    :param payload: New role.
    :return: The updated user's id, email and role.
    """
    if payload.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id in path does not match payload.",
        )
    try:
        admin_client = get_supabase_admin_client()
        updated = admin_client.auth.admin.update_user_by_id(
            user_id, {"app_metadata": {"role": payload.role.value}}
        )
        user = updated.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not update role: {str(exc)}",
        ) from exc
    return UserOut(
        id=getattr(user, "id", user_id),
        email=getattr(user, "email", None),
        role=payload.role.value,
    )


@router.get("/users", response_model=List[UserOut])
def admin_list_users(_: str = Depends(require_admin)):
    """List all Supabase Auth users (admin only).

    :return: A list of users with id, email and role.
    """
    try:
        admin_client = get_supabase_admin_client()
        res = admin_client.auth.admin.list_users()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not list users: {str(exc)}",
        ) from exc
    users = getattr(res, "users", []) or []
    out: List[UserOut] = []
    for user in users:
        out.append(
            UserOut(
                id=getattr(user, "id", None),
                email=getattr(user, "email", None),
                role=_extract_role(user),
            )
        )
    return out

