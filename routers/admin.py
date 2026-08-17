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

import io
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
import schemas
from routers.auth import require_admin
from routers.deps import get_db

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Pydantic request bodies (roster linking + import results)
# ---------------------------------------------------------------------------
class RosterEntry(BaseModel):
    """One row linking a player to a tournament/team roster.

    Provide ``player_id`` to link an existing player, or ``name`` /
    ``nickname`` to look players up by name before creating a new record.
    ``team_id`` is required in every case.
    """

    player_id: Optional[int] = None
    name: Optional[str] = None
    nickname: Optional[str] = None
    team_id: int


class RosterImportReport(BaseModel):
    """Per-row result of a roster file import."""

    created: List[dict] = []
    linked_existing: List[dict] = []
    errors: List[dict] = []


class SpiritImportReport(BaseModel):
    """Per-row result of a Spirit of the Game file import."""

    created: List[dict] = []
    updated: List[dict] = []
    errors: List[dict] = []


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _get_tournament_or_404(db: Session, tournament_id: int) -> models.Tournament:
    """Fetch a tournament by id or raise 404.

    :param db: SQLAlchemy session.
    :param tournament_id: Tournament primary key.
    :return: The requested tournament row.
    :raises HTTPException: 404 if not found.
    """
    tournament = (
        db.query(models.Tournament)
        .filter(models.Tournament.id == tournament_id)
        .first()
    )
    if tournament is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tournament with id {tournament_id} not found.",
        )
    return tournament


def _get_team_or_404(db: Session, team_id: int) -> models.Team:
    """Fetch a team by id or raise 404.

    :param db: SQLAlchemy session.
    :param team_id: Team primary key.
    :return: The requested team row.
    :raises HTTPException: 404 if not found.
    """
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with id {team_id} not found.",
        )
    return team


def _get_game_or_404(db: Session, game_id: int) -> models.Game:
    """Fetch a game by id or raise 404.

    :param db: SQLAlchemy session.
    :param game_id: Game primary key.
    :return: The requested game row.
    :raises HTTPException: 404 if not found.
    """
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game with id {game_id} not found.",
        )
    return game


def _parse_uploaded_file(file: UploadFile):
    """Read an uploaded CSV/XLSX into a list of dict rows.

    :param file: The uploaded file.
    :return: A list of dicts (one per row).
    :raises HTTPException: 400 for empty / unparsable / unsupported files.
    """
    try:
        import pandas as pd
    except ImportError as exc:  # pragma: no cover - depends on install
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pandas is required for file imports. Install requirements.txt.",
        ) from exc

    filename = (file.filename or "").lower()
    content = file.file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unsupported file format. Use .csv or .xlsx.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse file: {str(exc)}",
        ) from exc

    # Normalise column names: lowercase, strip, replace spaces.
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    records = df.to_dict(orient="records")
    if not records:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File contains no data rows.",
        )
    return records


def _get_or_create_team(db: Session, tournament_id: int, name: str) -> models.Team:
    """Find a team by name within a tournament, or create it.

    :param db: SQLAlchemy session.
    :param tournament_id: Tournament primary key.
    :param name: Exact team name to match.
    :return: The existing (or newly created) team.
    """
    name = (name or "").strip()
    if not name:
        raise ValueError("team name is required.")
    team = (
        db.query(models.Team)
        .filter(
            models.Team.tournament_id == tournament_id,
            models.Team.name == name,
        )
        .first()
    )
    if team is None:
        team = models.Team(name=name, tournament_id=tournament_id)
        db.add(team)
        db.flush()
    return team


def _match_existing_player(db: Session, nickname: Optional[str], name: Optional[str]) -> Optional[models.Player]:
    """Match a player by nickname (primary) then by full name.

    :param db: SQLAlchemy session.
    :param nickname: Optional player nickname.
    :param name: Optional full name (first_name + last_name).
    :return: The matched player or None.
    """
    if nickname:
        parts = [p.strip() for p in str(nickname).split(" ", 1)]
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""
        candidate = (
            db.query(models.Player)
            .filter(
                models.Player.first_name == first,
                models.Player.last_name == last,
            )
            .first()
        )
        if candidate:
            return candidate
    if name:
        parts = [p.strip() for p in str(name).split(" ", 1)]
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""
        candidate = (
            db.query(models.Player)
            .filter(
                models.Player.first_name == first,
                models.Player.last_name == last,
            )
            .first()
        )
        if candidate:
            return candidate
    return None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Tournament CRUD
# ---------------------------------------------------------------------------
@router.post("/tournaments", response_model=schemas.Tournament, status_code=status.HTTP_201_CREATED)
def admin_create_tournament(
    payload: schemas.TournamentCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Create a tournament (admin only).

    :param payload: Tournament data.
    :param db: SQLAlchemy session.
    :return: The created tournament.
    """
    if payload.end_date <= payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be after start_date.",
        )
    try:
        tournament = models.Tournament(**payload.dict())
        db.add(tournament)
        db.commit()
        db.refresh(tournament)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create tournament: {str(exc)}",
        ) from exc
    return tournament


@router.put("/tournaments/{tournament_id}", response_model=schemas.Tournament)
def admin_update_tournament(
    tournament_id: int,
    payload: schemas.TournamentUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Update a tournament (admin only).

    :param tournament_id: Tournament primary key.
    :param payload: Fields to update.
    :param db: SQLAlchemy session.
    :return: The updated tournament.
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    update_data = payload.dict(exclude_unset=True)
    if "start_date" in update_data and "end_date" in update_data:
        if update_data["end_date"] <= update_data["start_date"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end_date must be after start_date.",
            )
    try:
        for field, value in update_data.items():
            setattr(tournament, field, value)
        db.commit()
        db.refresh(tournament)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update tournament: {str(exc)}",
        ) from exc
    return tournament


@router.delete("/tournaments/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Delete a tournament and cascade to its teams, games and stats.

    :param tournament_id: Tournament primary key.
    :param db: SQLAlchemy session.
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    try:
        db.delete(tournament)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete tournament: {str(exc)}",
        ) from exc


# ---------------------------------------------------------------------------
# Team CRUD
# ---------------------------------------------------------------------------
@router.post("/teams", response_model=schemas.Team, status_code=status.HTTP_201_CREATED)
def admin_create_team(
    payload: schemas.TeamCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Create a team (admin only).

    :param payload: Team data.
    :param db: SQLAlchemy session.
    :return: The created team.
    """
    _get_tournament_or_404(db, payload.tournament_id)
    try:
        team = models.Team(**payload.dict())
        db.add(team)
        db.commit()
        db.refresh(team)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create team: {str(exc)}",
        ) from exc
    return team


@router.put("/teams/{team_id}", response_model=schemas.Team)
def admin_update_team(
    team_id: int,
    payload: schemas.TeamUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Update a team (admin only).

    :param team_id: Team primary key.
    :param payload: Fields to update.
    :param db: SQLAlchemy session.
    :return: The updated team.
    """
    team = _get_team_or_404(db, team_id)
    update_data = payload.dict(exclude_unset=True)
    if "tournament_id" in update_data:
        _get_tournament_or_404(db, update_data["tournament_id"])
    try:
        for field, value in update_data.items():
            setattr(team, field, value)
        db.commit()
        db.refresh(team)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update team: {str(exc)}",
        ) from exc
    return team


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Delete a team (admin only).

    :param team_id: Team primary key.
    :param db: SQLAlchemy session.
    """
    team = _get_team_or_404(db, team_id)
    try:
        db.delete(team)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete team: {str(exc)}",
        ) from exc


# ---------------------------------------------------------------------------
# Player CRUD
# ---------------------------------------------------------------------------
@router.post("/players", response_model=schemas.Player, status_code=status.HTTP_201_CREATED)
def admin_create_player(
    payload: schemas.PlayerCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Create a player (admin only).

    :param payload: Player data.
    :param db: SQLAlchemy session.
    :return: The created player.
    """
    _get_team_or_404(db, payload.team_id)
    try:
        player = models.Player(**payload.dict())
        db.add(player)
        db.commit()
        db.refresh(player)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create player: {str(exc)}",
        ) from exc
    return player


@router.put("/players/{player_id}", response_model=schemas.Player)
def admin_update_player(
    player_id: int,
    payload: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Update a player (admin only).

    :param player_id: Player primary key.
    :param payload: Fields to update.
    :param db: SQLAlchemy session.
    :return: The updated player.
    """
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with id {player_id} not found.",
        )
    update_data = payload.dict(exclude_unset=True)
    if "team_id" in update_data:
        _get_team_or_404(db, update_data["team_id"])
    try:
        for field, value in update_data.items():
            setattr(player, field, value)
        db.commit()
        db.refresh(player)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update player: {str(exc)}",
        ) from exc
    return player


@router.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Delete a player (admin only).

    :param player_id: Player primary key.
    :param db: SQLAlchemy session.
    """
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with id {player_id} not found.",
        )
    try:
        db.delete(player)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete player: {str(exc)}",
        ) from exc


# ---------------------------------------------------------------------------
# Game CRUD
# ---------------------------------------------------------------------------
@router.post("/games", response_model=schemas.Game, status_code=status.HTTP_201_CREATED)
def admin_create_game(
    payload: schemas.GameCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Create a game (admin only).

    :param payload: Game data.
    :param db: SQLAlchemy session.
    :return: The created game.
    """
    _get_tournament_or_404(db, payload.tournament_id)
    _get_team_or_404(db, payload.home_team_id)
    _get_team_or_404(db, payload.away_team_id)
    if payload.home_team_id == payload.away_team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A game cannot be scheduled between the same team.",
        )
    try:
        game = models.Game(**payload.dict())
        db.add(game)
        db.commit()
        db.refresh(game)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create game: {str(exc)}",
        ) from exc
    return game


@router.put("/games/{game_id}", response_model=schemas.Game)
def admin_update_game(
    game_id: int,
    payload: schemas.GameUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Update a game (admin only).

    :param game_id: Game primary key.
    :param payload: Fields to update.
    :param db: SQLAlchemy session.
    :return: The updated game.
    """
    game = _get_game_or_404(db, game_id)
    update_data = payload.dict(exclude_unset=True)
    if "tournament_id" in update_data:
        _get_tournament_or_404(db, update_data["tournament_id"])
    try:
        for field, value in update_data.items():
            setattr(game, field, value)
        db.commit()
        db.refresh(game)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update game: {str(exc)}",
        ) from exc
    return game


@router.delete("/games/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_game(
    game_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Delete a game (admin only).

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    """
    game = _get_game_or_404(db, game_id)
    try:
        db.delete(game)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete game: {str(exc)}",
        ) from exc


# ---------------------------------------------------------------------------
# Roster linking (JSON body)
# ---------------------------------------------------------------------------
@router.post("/tournaments/{tournament_id}/roster", response_model=RosterImportReport)
def admin_link_roster(
    tournament_id: int,
    entries: List[RosterEntry],
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Link existing players to a tournament/team roster, or create them.

    Body: ``[{"player_id"?, "name"?, "nickname"?, "team_id"}]``. Players are
    matched by exact name/nickname before creating new records to avoid
    duplicates.

    :param tournament_id: Tournament primary key.
    :param entries: Roster rows.
    :param db: SQLAlchemy session.
    :return: Per-row report with ``created`` / ``linked_existing`` / ``errors``.
    """
    _get_tournament_or_404(db, tournament_id)
    created: List[dict] = []
    linked_existing: List[dict] = []
    errors: List[dict] = []

    for idx, entry in enumerate(entries):
        try:
            team = _get_team_or_404(db, entry.team_id)
            if team.tournament_id != tournament_id:
                raise ValueError(
                    f"team {entry.team_id} does not belong to tournament {tournament_id}."
                )

            # Matching priority: explicit player_id, then nickname, then name.
            player = None
            if entry.player_id is not None:
                player = (
                    db.query(models.Player)
                    .filter(models.Player.id == entry.player_id)
                    .first()
                )
                if player is None:
                    raise ValueError(f"player_id {entry.player_id} not found.")
            else:
                player = _match_existing_player(db, entry.nickname, entry.name)

            if player is None:
                if not entry.name:
                    raise ValueError("Either 'player_id' or 'name' is required.")
                parts = [p.strip() for p in str(entry.name).split(" ", 1)]
                first = parts[0]
                last = parts[1] if len(parts) > 1 else ""
                player = models.Player(first_name=first, last_name=last, team_id=team.id)
                # Apply nickname as last_name if no full name was given.
                if entry.nickname and last == "":
                    player.last_name = str(entry.nickname).strip()
                db.add(player)
                db.flush()
                created.append(
                    {
                        "row": idx + 1,
                        "player_id": player.id,
                        "name": f"{player.first_name} {player.last_name}".strip(),
                        "team_id": team.id,
                    }
                )
            else:
                # Re-point the player to the requested team if it differs.
                if player.team_id != team.id:
                    player.team_id = team.id
                linked_existing.append(
                    {
                        "row": idx + 1,
                        "player_id": player.id,
                        "name": f"{player.first_name} {player.last_name}".strip(),
                        "team_id": team.id,
                    }
                )
        except HTTPException:
            raise
        except Exception as exc:
            errors.append({"row": idx + 1, "reason": str(exc)})

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not commit roster: {str(exc)}",
        ) from exc

    return RosterImportReport(created=created, linked_existing=linked_existing, errors=errors)


# ---------------------------------------------------------------------------
# Roster file import (CSV / XLSX)
# ---------------------------------------------------------------------------
@router.post("/tournaments/{tournament_id}/roster/import", response_model=RosterImportReport)
async def admin_import_roster(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Import a roster from CSV/XLSX.

    Required columns: ``name``, ``nickname``, ``team``. Any additional columns
    are treated as optional player stats and mapped to existing stat fields;
    unknown columns are ignored with a warning.

    Upsert semantics: match existing players by ``nickname`` (primary) then
    ``name``; match teams by name within the tournament.

    :param tournament_id: Tournament primary key.
    :param file: ``.csv`` or ``.xlsx`` file.
    :param db: SQLAlchemy session.
    :return: Per-row report with ``created`` / ``linked_existing`` / ``errors``.
    """
    _get_tournament_or_404(db, tournament_id)
    records = _parse_uploaded_file(file)

    required = {"name", "nickname", "team"}
    present = {k for k in records[0].keys()}
    missing = required - present
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required columns: {', '.join(sorted(missing))}.",
        )

    created: List[dict] = []
    linked_existing: List[dict] = []
    errors: List[dict] = []

    for idx, row in enumerate(records):
        try:
            name = str(row.get("name") or "").strip()
            nickname = str(row.get("nickname") or "").strip()
            team_name = str(row.get("team") or "").strip()
            if not name or not team_name:
                raise ValueError("name and team are required per row.")

            team = _get_or_create_team(db, tournament_id, team_name)
            player = _match_existing_player(db, nickname, name)

            if player is None:
                parts = [p.strip() for p in name.split(" ", 1)]
                first = parts[0]
                last = parts[1] if len(parts) > 1 else (nickname or "")
                player = models.Player(first_name=first, last_name=last, team_id=team.id)
                db.add(player)
                db.flush()
                created.append(
                    {
                        "row": idx + 1,
                        "player_id": player.id,
                        "name": f"{player.first_name} {player.last_name}".strip(),
                        "team": team.name,
                        "team_id": team.id,
                    }
                )
            else:
                if player.team_id != team.id:
                    player.team_id = team.id
                linked_existing.append(
                    {
                        "row": idx + 1,
                        "player_id": player.id,
                        "name": f"{player.first_name} {player.last_name}".strip(),
                        "team": team.name,
                        "team_id": team.id,
                    }
                )
        except Exception as exc:
            errors.append({"row": idx + 1, "reason": str(exc)})

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not commit roster import: {str(exc)}",
        ) from exc

    return RosterImportReport(created=created, linked_existing=linked_existing, errors=errors)


# ---------------------------------------------------------------------------
# Spirit of the Game (SOTG) file import
# ---------------------------------------------------------------------------
@router.post("/tournaments/{tournament_id}/spirit/import", response_model=SpiritImportReport)
async def admin_import_spirit(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Import Spirit of the Game scores from CSV/XLSX.

    Columns: ``team``, ``team_against``, ``score_1``..``score_5`` (WFDF SOTG
    categories: rules knowledge, fouls & contact, fair-mindedness, positive
    attitude, communication). Each score must be an integer in 0–4.

    Upsert on ``(tournament_id, team, team_against)``; the total (sum of the
    five scores) is computed and stored.

    :param tournament_id: Tournament primary key.
    :param file: ``.csv`` or ``.xlsx`` file.
    :param db: SQLAlchemy session.
    :return: Per-row report with ``created`` / ``updated`` / ``errors``.
    """
    _get_tournament_or_404(db, tournament_id)
    records = _parse_uploaded_file(file)

    required = {"team", "team_against", "score_1", "score_2", "score_3", "score_4", "score_5"}
    present = {k for k in records[0].keys()}
    missing = required - present
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Missing required columns: {', '.join(sorted(missing))}.",
        )

    created: List[dict] = []
    updated: List[dict] = []
    errors: List[dict] = []

    for idx, row in enumerate(records):
        try:
            team_name = str(row.get("team") or "").strip()
            against_name = str(row.get("team_against") or "").strip()
            if not team_name or not against_name:
                raise ValueError("team and team_against are required per row.")

            scores = []
            for key in ["score_1", "score_2", "score_3", "score_4", "score_5"]:
                raw = row.get(key)
                try:
                    val = int(raw)
                except (TypeError, ValueError):
                    raise ValueError(f"{key} must be an integer.")
                if val < 0 or val > 4:
                    raise ValueError(f"{key} must be between 0 and 4.")
                scores.append(val)
            total = sum(scores)

            team = _get_or_create_team(db, tournament_id, team_name)
            against = _get_or_create_team(db, tournament_id, against_name)

            spirit = (
                db.query(models.SpiritScore)
                .filter(
                    models.SpiritScore.tournament_id == tournament_id,
                    models.SpiritScore.team_id == team.id,
                    models.SpiritScore.team_against_id == against.id,
                )
                .first()
            )
            if spirit is None:
                spirit = models.SpiritScore(
                    tournament_id=tournament_id,
                    team_id=team.id,
                    team_against_id=against.id,
                    score_1=scores[0],
                    score_2=scores[1],
                    score_3=scores[2],
                    score_4=scores[3],
                    score_5=scores[4],
                    total=total,
                )
                db.add(spirit)
                db.flush()
                created.append(
                    {
                        "row": idx + 1,
                        "team": team.name,
                        "team_against": against.name,
                        "total": total,
                    }
                )
            else:
                spirit.score_1 = scores[0]
                spirit.score_2 = scores[1]
                spirit.score_3 = scores[2]
                spirit.score_4 = scores[3]
                spirit.score_5 = scores[4]
                spirit.total = total
                updated.append(
                    {
                        "row": idx + 1,
                        "team": team.name,
                        "team_against": against.name,
                        "total": total,
                    }
                )
        except Exception as exc:
            errors.append({"row": idx + 1, "reason": str(exc)})

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not commit spirit import: {str(exc)}",
        ) from exc

    return SpiritImportReport(created=created, updated=updated, errors=errors)


# ---------------------------------------------------------------------------
# Per-game spirit score entry
# ---------------------------------------------------------------------------
class GameSpiritEntry(BaseModel):
    """Per-side spirit score for a finished game.

    Each side records a single 0–10 number (the WFDF 5-category total) which
    the standings engine averages into ``spirit_average``. Either field is
    optional so a scorekeeper can fill in home today and away later.
    """

    spirit_home: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    spirit_away: Optional[float] = Field(default=None, ge=0.0, le=10.0)


class GameSpiritReport(BaseModel):
    game_id: int
    spirit_home: Optional[float]
    spirit_away: Optional[float]


@router.put(
    "/games/{game_id}/spirit",
    response_model=GameSpiritReport,
)
def admin_set_game_spirit(
    game_id: int,
    payload: GameSpiritEntry,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Record (or update) the home/away spirit scores for a single game.

    Both sides are optional; omitting a side leaves its existing value
    untouched. Scores are clamped to ``[0, 10]`` by the pydantic validator.
    """
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if game is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Game with id {game_id} not found.",
        )
    if payload.spirit_home is not None:
        game.spirit_home = payload.spirit_home
    if payload.spirit_away is not None:
        game.spirit_away = payload.spirit_away
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save spirit scores: {exc}",
        ) from exc
    db.refresh(game)
    return GameSpiritReport(
        game_id=game.id,
        spirit_home=game.spirit_home,
        spirit_away=game.spirit_away,
    )


# ---------------------------------------------------------------------------
# Bulk import: players + auto-create teams
# ---------------------------------------------------------------------------
class BulkPlayerImportRow(BaseModel):
    """One player row from CSV import."""
    player_name: str = Field(..., alias="player name")
    player_lastname: str = Field(..., alias="player lastname")
    player_number: str = Field(..., alias="player number")
    team: str
    gender: Optional[str] = None
    nationality: Optional[str] = None
    other: Optional[str] = None

    class Config:
        populate_by_name = True


class BulkImportPayload(BaseModel):
    """Bulk player import request.

    `players` is the raw list of dicts as parsed from the CSV. Headers in
    each row are NOT assumed to match any canonical name; instead the
    admin UI supplies a `column_map` whose keys are the canonical field
    names (`"player name"`, `"player lastname"`, etc.) and values are the
    actual CSV header for that field in this particular file.

    `column_map` is optional for backward compatibility: when omitted,
    the row normalizer falls back to the canonical-name lookup (case
    insensitive, trimmed).

    `edited_players` is the EDITED preview the admin UI produced after
    the user reviewed the proposed rows. When supplied, the backend
    treats each entry as the canonical record (same shape as
    `BulkImportPreview.proposed_players[i]`) and skips the
    column-normalize step. This is what makes the user's edits in the
    preview UI authoritative.
    """
    players: List[dict]
    column_map: Optional[Dict[str, str]] = None
    edited_players: Optional[List[dict]] = None


# Canonical field names recognized by the bulk-import row normalizer.
# These match the keys we expect in `BulkPlayerImportRow` and the column
# labels surfaced in the admin UI's mapping step.
BULK_IMPORT_CANONICAL_FIELDS = (
    "player name",
    "player lastname",
    "player last name",
    "player number",
    "team",
    "gender",
    "nationality",
    "other",
)


class BulkImportReport(BaseModel):
    """Result of bulk player + team import."""
    teams_created: int = 0
    players_created: int = 0
    teams: List[schemas.Team] = []
    players: List[schemas.Player] = []
    errors: List[dict] = []


class BulkImportPreview(BaseModel):
    """Dry-run result: counts + the rows the import WOULD create, no DB writes.

    `proposed_teams` and `proposed_players` carry just enough fields for the
    admin UI to render a confirmation table (name + jersey + profile
    columns). No DB IDs are populated because nothing is persisted.

    `existing_teams` lists teams already in the tournament so the UI's
    team picker can be exhaustive without a second round-trip.
    """
    teams_to_create: int = 0
    players_to_create: int = 0
    proposed_teams: List[dict] = []
    existing_teams: List[dict] = []
    proposed_players: List[dict] = []
    errors: List[dict] = []


def _normalize_bulk_row(
    idx: int,
    row: dict,
    column_map: Optional[Dict[str, str]] = None,
) -> Dict[str, Optional[str]]:
    """Extract the normalized cell values from one CSV row.

    Returns a dict with all six known fields (lastname, team, etc.). Throws
    ValueError for rows that are structurally invalid or missing required
    fields, so the caller can record a clean `{row, reason}` error.

    The optional `column_map` lets the caller override which CSV column
    supplies each canonical field. Keys are canonical field names
    (e.g. "player name", "team"), values are the actual CSV header for
    that field in this file. When `column_map` is None or doesn't name a
    given canonical field, the helper falls back to case-insensitive
    lookup against the canonical name.
    """
    if not isinstance(row, dict):
        raise ValueError("Row is not a dict")

    row_lower = {str(k).strip().lower(): v for k, v in row.items()}

    def cell(canonical: str) -> str:
        """Read one cell, honoring the column_map when present.

        For the player lastname canonical name we accept either
        "player lastname" or "player last name" as the map key, so the
        admin UI can map either header.
        """
        candidates: List[str] = []
        if column_map:
            mapped = column_map.get(canonical)
            if mapped:
                candidates.append(mapped)
            # Special case: "player lastname" and "player last name" are
            # interchangeable aliases.
            if canonical == "player lastname":
                mapped_alt = column_map.get("player last name")
                if mapped_alt:
                    candidates.append(mapped_alt)
        # Fallback: case-insensitive canonical name lookup.
        candidates.append(canonical)
        if canonical == "player lastname":
            candidates.append("player last name")

        for header in candidates:
            value = row_lower.get(str(header).strip().lower())
            if value is not None:
                return str(value).strip()
        return ""

    player_name = cell("player name")
    player_lastname = cell("player lastname")
    player_number = cell("player number")
    team_name = cell("team")
    gender = cell("gender") or None
    nationality = cell("nationality") or None
    other = cell("other") or None

    if not player_name or not player_lastname or not team_name:
        raise ValueError("Missing required fields (name, lastname, team)")

    return {
        "player_name": player_name,
        "player_lastname": player_lastname,
        "player_number": player_number,
        "team_name": team_name,
        "gender": gender,
        "nationality": nationality,
        "other": other,
    }


def _process_bulk_rows(
    tournament_id: int,
    rows: List[dict],
    db: Session,
    *,
    persist: bool,
    column_map: Optional[Dict[str, str]] = None,
    edited_players: Optional[List[dict]] = None,
) -> Tuple[List[models.Team], List[models.Player], List[dict]]:
    """Shared core for the bulk-import preview + commit endpoints.

    When `persist=True` newly-created teams/players are added to the
    session and the caller is expected to commit. When `persist=False`
    we still `flush()` so we can read auto-generated IDs, but nothing is
    persisted: the caller is expected to rollback.

    `column_map` (optional) maps canonical field names to the actual
    CSV header for each field in the supplied file. When omitted, the
    row normalizer falls back to case-insensitive lookup against the
    canonical names.

    `edited_players` (optional) is the EDITED preview produced by the
    admin UI after the user has reviewed + corrected the rows. When
    supplied, each entry is treated as the canonical record and the
    column-normalize step is skipped — the user's edits are
    authoritative. Entries are expected to share the shape of
    `BulkImportPreview.proposed_players[i]`:
        first_name, last_name, jersey_number, team_name,
        gender, nationality, other.

    Returns (created_teams, created_players, errors). Per-row exceptions
    are captured into `errors`; only an unexpected error in the loop body
    itself is re-raised.
    """
    created_teams: List[models.Team] = []
    created_players: List[models.Player] = []
    errors: List[dict] = []
    team_cache: Dict[str, models.Team] = {}

    # When `edited_players` is supplied, it takes precedence over the
    # raw CSV rows: the admin has already reviewed and corrected them.
    source_row_labels: List[Dict[str, str]] = []
    if edited_players is not None:
        for idx, edited in enumerate(edited_players):
            if not isinstance(edited, dict):
                errors.append({
                    "row": idx + 1,
                    "reason": "Edited row is not an object",
                })
                continue

            first_name = str(edited.get("first_name") or "").strip()
            last_name = str(edited.get("last_name") or "").strip()
            team_name = str(edited.get("team_name") or "").strip()

            if not first_name or not last_name or not team_name:
                errors.append({
                    "row": idx + 1,
                    "reason": "Missing required fields (name, lastname, team)",
                })
                continue

            jersey_raw = edited.get("jersey_number", None)
            if jersey_raw in (None, ""):
                jersey_number: Optional[int] = None
            else:
                try:
                    jersey_number = int(jersey_raw)
                except (TypeError, ValueError):
                    errors.append({
                        "row": idx + 1,
                        "reason": f"Invalid jersey number: {jersey_raw!r}",
                    })
                    continue

            # Single-space sentinel for unset optional profile fields,
            # matching the convention used elsewhere in the schema.
            nationality_value = str(edited.get("nationality") or "").strip() or " "
            other_value = str(edited.get("other") or "").strip() or " "
            gender_value = (
                str(edited.get("gender")).strip()
                if edited.get("gender") is not None
                else None
            )

            try:
                if team_name not in team_cache:
                    team = (
                        db.query(models.Team)
                        .filter_by(name=team_name, tournament_id=tournament_id)
                        .first()
                    )
                    if not team:
                        team = models.Team(
                            name=team_name,
                            tournament_id=tournament_id,
                        )
                        db.add(team)
                        db.flush()
                        if persist:
                            created_teams.append(team)
                    team_cache[team_name] = team
                else:
                    team = team_cache[team_name]

                player = models.Player(
                    first_name=first_name,
                    last_name=last_name,
                    jersey_number=jersey_number,
                    team_id=team.id,
                    gender=gender_value or None,
                    nationality=nationality_value,
                    other=other_value,
                )
                db.add(player)
                db.flush()
                if persist:
                    created_players.append(player)
                else:
                    # In preview mode we still want to surface the
                    # parsed values for the UI, but the player has no
                    # DB id yet. Detach so its data survives the
                    # rollback.
                    db.expunge(player)
                    created_players.append(player)
            except Exception as exc:
                errors.append({"row": idx + 1, "reason": str(exc)})

        return created_teams, created_players, errors

    for idx, row in enumerate(rows):
        try:
            cells = _normalize_bulk_row(idx, row, column_map=column_map)
        except ValueError as exc:
            errors.append({"row": idx + 1, "reason": str(exc)})
            continue

        try:
            # Ensure team exists (or use the one we already queued).
            team_name = cells["team_name"]
            if team_name not in team_cache:
                team = (
                    db.query(models.Team)
                    .filter_by(name=team_name, tournament_id=tournament_id)
                    .first()
                )
                if not team:
                    team = models.Team(
                        name=team_name,
                        tournament_id=tournament_id,
                    )
                    db.add(team)
                    db.flush()
                    if persist:
                        created_teams.append(team)
                team_cache[team_name] = team
            else:
                team = team_cache[team_name]

            player_number_raw = cells["player_number"]
            jersey_number = (
                int(player_number_raw) if player_number_raw.isdigit() else None
            )

            # Single-space sentinel for unset optional profile fields,
            # matching the convention used elsewhere in the schema.
            nationality_value = cells["nationality"] or " "
            other_value = cells["other"] or " "

            player = models.Player(
                first_name=cells["player_name"],
                last_name=cells["player_lastname"],
                jersey_number=jersey_number,
                team_id=team.id,
                gender=cells["gender"],
                nationality=nationality_value,
                other=other_value,
            )
            db.add(player)
            db.flush()
            if persist:
                created_players.append(player)
            else:
                # In preview mode we still want to surface the parsed
                # values for the UI, but the player has no DB id yet.
                # Detach so its data survives the rollback.
                db.expunge(player)
                created_players.append(player)

        except Exception as exc:
            errors.append({"row": idx + 1, "reason": str(exc)})

    return created_teams, created_players, errors


def _ensure_tournament_or_404(
    db: Session, tournament_id: int
) -> models.Tournament:
    tournament = (
        db.query(models.Tournament).filter_by(id=tournament_id).first()
    )
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tournament {tournament_id} not found",
        )
    return tournament


@router.post(
    "/tournaments/{tournament_id}/bulk-import/preview",
    response_model=BulkImportPreview,
)
def bulk_import_preview(
    tournament_id: int,
    payload: BulkImportPayload,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Dry-run a bulk roster import.

    Validates every row, builds proposed teams + players, returns the
    summary the admin UI needs to render a confirmation table, but does
    NOT write to the database. Any `db.flush()` side-effects are rolled
    back at the end.
    """
    _ensure_tournament_or_404(db, tournament_id)

    created_teams, created_players, errors = _process_bulk_rows(
        tournament_id,
        payload.players,
        db,
        persist=False,
        column_map=payload.column_map,
    )

    # Rollback any incidental writes from flush() — preview must be a
    # pure read on the database side.
    db.rollback()

    # Snapshot the team's existing teams so the UI picker can be
    # exhaustive without a second round-trip. The CSV's proposed
    # teams and the existing teams are returned separately; the
    # admin UI combines them in the dropdown.
    existing_team_rows = (
        db.query(models.Team).filter_by(tournament_id=tournament_id).all()
    )
    existing_teams = [
        {"id": t.id, "name": t.name, "tournament_id": t.tournament_id}
        for t in existing_team_rows
    ]

    proposed_teams = [
        {"name": t.name, "tournament_id": t.tournament_id}
        for t in created_teams
    ]
    proposed_players = [
        {
            "first_name": p.first_name,
            "last_name": p.last_name,
            "jersey_number": p.jersey_number,
            "team_name": next(
                t.name
                for t in created_teams
                if t.id == p.team_id
            )
            if any(t.id == p.team_id for t in created_teams)
            else None,
            "gender": p.gender,
            "nationality": p.nationality,
            "other": p.other,
        }
        for p in created_players
    ]

    return BulkImportPreview(
        teams_to_create=len(created_teams),
        players_to_create=len(created_players),
        proposed_teams=proposed_teams,
        existing_teams=existing_teams,
        proposed_players=proposed_players,
        errors=errors,
    )


@router.post(
    "/tournaments/{tournament_id}/bulk-import/commit",
    response_model=BulkImportReport,
)
def bulk_import_commit(
    tournament_id: int,
    payload: BulkImportPayload,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Persist a bulk roster import.

    Expects the same payload the admin UI used for the preview step. The
    client is expected to show the preview, let the user confirm, and
    only then POST here.
    """
    _ensure_tournament_or_404(db, tournament_id)

    created_teams, created_players, errors = _process_bulk_rows(
        tournament_id,
        payload.players,
        db,
        persist=True,
        column_map=payload.column_map,
        edited_players=payload.edited_players,
    )

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not commit bulk import: {str(exc)}",
        ) from exc

    all_teams = (
        db.query(models.Team).filter_by(tournament_id=tournament_id).all()
    )

    return BulkImportReport(
        teams_created=len(created_teams),
        players_created=len(created_players),
        teams=[schemas.Team.from_orm(t) for t in all_teams],
        players=[schemas.Player.from_orm(p) for p in created_players],
        errors=errors,
    )


# Legacy single-shot endpoint. Kept so any client still calling
# `POST /admin/tournaments/:id/bulk-import` (without /preview or /commit)
# keeps working until the UI is fully migrated to the two-step flow.
@router.post(
    "/tournaments/{tournament_id}/bulk-import",
    response_model=BulkImportReport,
)
def bulk_import_teams_and_players(
    tournament_id: int,
    payload: BulkImportPayload,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Bulk import players from CSV/XLSX. Auto-creates teams if needed.

    Expects rows with columns:
    - player name (first name)
    - player lastname OR "player last name" (last name; both spellings accepted)
    - player number
    - team (team name; created if doesn't exist)
    - gender (optional)
    - nationality (optional)
    - other (optional)

    Returns counts + lists of created teams/players + any errors.
    """
    _ensure_tournament_or_404(db, tournament_id)

    created_teams, created_players, errors = _process_bulk_rows(
        tournament_id,
        payload.players,
        db,
        persist=True,
        column_map=payload.column_map,
        edited_players=payload.edited_players,
    )

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not commit bulk import: {str(exc)}",
        ) from exc

    all_teams = (
        db.query(models.Team).filter_by(tournament_id=tournament_id).all()
    )

    return BulkImportReport(
        teams_created=len(created_teams),
        players_created=len(created_players),
        teams=[schemas.Team.from_orm(t) for t in all_teams],
        players=[schemas.Player.from_orm(p) for p in created_players],
        errors=errors,
    )
