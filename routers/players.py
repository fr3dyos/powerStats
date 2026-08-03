"""Player management endpoints.

Provides CRUD for players, photo upload to Supabase Storage, and an
aggregation endpoint that returns a player's stats across **all**
tournaments (historical lookup by ``player_id``).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import models
import schemas
from routers.deps import build_file_path, get_db, upload_to_supabase_storage

router = APIRouter(prefix="/players", tags=["players"])

PHOTO_BUCKET = "player-photos"


def _get_player_or_404(db: Session, player_id: int) -> models.Player:
    """Fetch a player by id or raise 404.

    :param db: SQLAlchemy session.
    :param player_id: Player primary key.
    :return: The requested player row.
    :raises HTTPException: 404 if not found.
    """
    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with id {player_id} not found.",
        )
    return player


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


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------
@router.get("", response_model=List[schemas.Player])
def list_players(
    team_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List players, optionally filtered by team.

    :param team_id: Optional team id filter.
    :param skip: Number of rows to skip.
    :param limit: Maximum rows to return.
    :param db: SQLAlchemy session.
    :return: List of players ordered by last name then first name.
    """
    try:
        query = db.query(models.Player)
        if team_id is not None:
            query = query.filter(models.Player.team_id == team_id)
        players = (
            query.order_by(models.Player.last_name.asc(), models.Player.first_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not list players: {str(exc)}",
        ) from exc
    return players


@router.post("", response_model=schemas.Player, status_code=status.HTTP_201_CREATED)
def create_player(payload: schemas.PlayerCreate, db: Session = Depends(get_db)):
    """Create a new player.

    :param payload: Player data (names, jersey_number, team_id).
    :param db: SQLAlchemy session.
    :return: The created player.
    """
    _get_team_or_404(db, payload.team_id)
    try:
        player = models.Player(
            first_name=payload.first_name,
            last_name=payload.last_name,
            jersey_number=payload.jersey_number,
            team_id=payload.team_id,
        )
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


@router.get("/{player_id}", response_model=schemas.PlayerWithEvents)
def get_player(player_id: int, db: Session = Depends(get_db)):
    """Fetch a single player including their game events.

    :param player_id: Player primary key.
    :param db: SQLAlchemy session.
    :return: Player with ``game_events`` relationship loaded.
    """
    return _get_player_or_404(db, player_id)


@router.put("/{player_id}", response_model=schemas.Player)
def update_player(
    player_id: int,
    payload: schemas.PlayerUpdate,
    db: Session = Depends(get_db),
):
    """Update player fields (partial update).

    :param player_id: Player primary key.
    :param payload: Fields to update.
    :param db: SQLAlchemy session.
    :return: The updated player.
    """
    player = _get_player_or_404(db, player_id)
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


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(player_id: int, db: Session = Depends(get_db)):
    """Delete a player.

    :param player_id: Player primary key.
    :param db: SQLAlchemy session.
    """
    player = _get_player_or_404(db, player_id)
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
# Photo upload
# ---------------------------------------------------------------------------
@router.post("/{player_id}/photo", response_model=dict)
async def upload_player_photo(
    player_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a photo for a player to Supabase Storage.

    The player model has no ``photo_url`` column, so the returned public URL
    is stored in ``Player`` metadata via the team's tournament context is not
    possible. To stay consistent with the schema we return the player with a
    ``photo_url`` placed in the response via an attached attribute; if the
    schema is later extended, persist the URL to a real column.

    :param player_id: Player primary key.
    :param file: Image file (jpeg/png/webp/gif).
    :param db: SQLAlchemy session.
    :return: Player object (with ``photo_url`` if the model supports it).
    """
    player = _get_player_or_404(db, player_id)
    _get_team_or_404(db, player.team_id)

    file_path = build_file_path("players", player_id, file.filename or "photo")
    public_url = upload_to_supabase_storage(
        bucket=PHOTO_BUCKET,
        file_path=file_path,
        file=file,
    )

    # The Player model currently has no photo column; attach the URL so the
    # response is still useful. If a photo_url column is added, persist it.
    try:
        db.refresh(player)
        if hasattr(player, "photo_url"):
            player.photo_url = public_url
            db.commit()
            db.refresh(player)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Photo uploaded but could not update player record: {str(exc)}",
        ) from exc

    # Return a dict so we can include photo_url without schema changes.
    player_data = schemas.Player.from_orm(player)
    return {**player_data.dict(), "photo_url": public_url}


# ---------------------------------------------------------------------------
# Cross-tournament stats aggregation
# ---------------------------------------------------------------------------
@router.get("/{player_id}/stats", response_model=dict)
def get_player_stats_all_tournaments(player_id: int, db: Session = Depends(get_db)):
    """Return a player's stats aggregated across ALL tournaments.

    :param player_id: Player primary key.
    :param db: SQLAlchemy session.
    :return: Player info, per-tournament breakdown, and grand totals.
    """
    player = _get_player_or_404(db, player_id)

    try:
        stats_rows = (
            db.query(models.PlayerTournamentStats)
            .filter(models.PlayerTournamentStats.player_id == player_id)
            .all()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not load player stats: {str(exc)}",
        ) from exc

    per_tournament: List[dict] = []
    totals = {
        "games_played": 0,
        "goals": 0,
        "assists": 0,
        "defenses": 0,
        "goals_conceded": 0,
    }

    for row in stats_rows:
        tournament = (
            db.query(models.Tournament)
            .filter(models.Tournament.id == row.tournament_id)
            .first()
        )
        per_tournament.append(
            {
                "tournament_id": row.tournament_id,
                "tournament_name": tournament.name if tournament else None,
                "games_played": row.games_played,
                "goals": row.goals,
                "assists": row.assists,
                "defenses": row.defenses,
                "goals_conceded": row.goals_conceded,
            }
        )
        totals["games_played"] += row.games_played
        totals["goals"] += row.goals
        totals["assists"] += row.assists
        totals["defenses"] += row.defenses
        totals["goals_conceded"] += row.goals_conceded

    return {
        "player": {
            "id": player.id,
            "first_name": player.first_name,
            "last_name": player.last_name,
            "jersey_number": player.jersey_number,
            "team_id": player.team_id,
        },
        "total_tournaments": len(per_tournament),
        "per_tournament": per_tournament,
        "totals": totals,
    }

