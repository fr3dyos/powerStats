"""Team management endpoints.

Provides CRUD for teams plus logo upload to Supabase Storage.
Logo uploads persist the resulting public URL onto the team row's
``logo_url`` column.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

import models
import schemas
from routers.deps import build_file_path, get_db, upload_to_supabase_storage
from routers.auth import require_admin, require_public, require_scorekeeper

router = APIRouter(prefix="/teams", tags=["teams"])

LOGO_BUCKET = "team-logos"


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


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------
@router.get("", response_model=List[schemas.Team])
def list_teams(
    tournament_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: str = Depends(require_public),
):
    """List teams, optionally filtered by tournament.

    :param tournament_id: Optional tournament id filter.
    :param skip: Number of rows to skip.
    :param limit: Maximum rows to return.
    :param db: SQLAlchemy session.
    :return: List of teams ordered by name.
    """
    try:
        query = db.query(models.Team)
        if tournament_id is not None:
            query = query.filter(models.Team.tournament_id == tournament_id)
        teams = query.order_by(models.Team.name.asc()).offset(skip).limit(limit).all()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not list teams: {str(exc)}",
        ) from exc
    return teams


@router.post("", response_model=schemas.Team, status_code=status.HTTP_201_CREATED)
def create_team(payload: schemas.TeamCreate, db: Session = Depends(get_db), _: str = Depends(require_scorekeeper)):
    """Create a new team.

    :param payload: Team data (name, tournament_id, optional logo_url).
    :param db: SQLAlchemy session.
    :return: The created team.
    """
    _get_tournament_or_404(db, payload.tournament_id)
    try:
        team = models.Team(
            name=payload.name,
            tournament_id=payload.tournament_id,
            logo_url=payload.logo_url,
        )
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


@router.get("/{team_id}", response_model=schemas.TeamWithPlayers)
def get_team(team_id: int, db: Session = Depends(get_db), _: str = Depends(require_public)):
    """Fetch a single team including its players.

    :param team_id: Team primary key.
    :param db: SQLAlchemy session.
    :return: Team with ``players`` relationship loaded.
    """
    return _get_team_or_404(db, team_id)


@router.put("/{team_id}", response_model=schemas.Team)
def update_team(
    team_id: int,
    payload: schemas.TeamUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Update team fields (partial update).

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


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(team_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    """Delete a team.

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
# Logo upload
# ---------------------------------------------------------------------------
@router.post("/{team_id}/logo", response_model=schemas.Team)
async def upload_team_logo(
    team_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Upload a logo image for a team to Supabase Storage.

    Updates the team's ``logo_url`` with the returned public URL.

    :param team_id: Team primary key.
    :param file: Image file (jpeg/png/webp/gif).
    :param db: SQLAlchemy session.
    :return: The updated team with its new ``logo_url``.
    """
    team = _get_team_or_404(db, team_id)

    # Validate the owning tournament exists before writing anything.
    _get_tournament_or_404(db, team.tournament_id)

    file_path = build_file_path("teams", team_id, file.filename or "logo")
    public_url = upload_to_supabase_storage(
        bucket=LOGO_BUCKET,
        file_path=file_path,
        file=file,
    )

    try:
        team.logo_url = public_url
        db.commit()
        db.refresh(team)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Logo uploaded but could not update team record: {str(exc)}",
        ) from exc
    return team

