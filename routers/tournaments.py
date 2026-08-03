"""Tournament management endpoints.

Provides full CRUD for tournaments plus three scheduling features:

- ``POST /tournaments/{id}/bracket`` — single-elimination bracket generation.
- ``POST /tournaments/{id}/round-robin`` — round-robin fixture generation.
- ``POST /tournaments/{id}/schedule-suggestion`` — suggests a schedule
  given the number of available fields.

Bracket / round-robin generation only creates fixture *structures* (returned
as JSON). Persisted ``games`` rows are created only when the caller passes
``persist=True``.
"""

import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import models
import schemas
from routers.deps import get_db

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------
def _get_tournament_or_404(db: Session, tournament_id: int) -> models.Tournament:
    """Fetch a tournament by id or raise 404.

    :param db: SQLAlchemy session.
    :param tournament_id: Tournament primary key.
    :return: The requested tournament row.
    :raises HTTPException: 404 if not found.
    """
    tournament = db.query(models.Tournament).filter(
        models.Tournament.id == tournament_id
    ).first()
    if tournament is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tournament with id {tournament_id} not found.",
        )
    return tournament


@router.get("", response_model=List[schemas.Tournament])
def list_tournaments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List tournaments with pagination.

    :param skip: Number of rows to skip.
    :param limit: Maximum number of rows to return.
    :param db: SQLAlchemy session.
    :return: List of tournaments ordered by start date (newest first).
    """
    try:
        tournaments = (
            db.query(models.Tournament)
            .order_by(models.Tournament.start_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not list tournaments: {str(exc)}",
        ) from exc
    return tournaments


@router.post("", response_model=schemas.Tournament, status_code=status.HTTP_201_CREATED)
def create_tournament(
    payload: schemas.TournamentCreate,
    db: Session = Depends(get_db),
):
    """Create a new tournament.

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
        tournament = models.Tournament(
            name=payload.name,
            start_date=payload.start_date,
            end_date=payload.end_date,
            location=payload.location,
            description=payload.description,
        )
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


@router.get("/{tournament_id}", response_model=schemas.TournamentWithTeams)
def get_tournament(tournament_id: int, db: Session = Depends(get_db)):
    """Fetch a single tournament including its teams.

    :param tournament_id: Tournament primary key.
    :param db: SQLAlchemy session.
    :return: Tournament with ``teams`` relationship loaded.
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    return tournament


@router.put("/{tournament_id}", response_model=schemas.Tournament)
def update_tournament(
    tournament_id: int,
    payload: schemas.TournamentUpdate,
    db: Session = Depends(get_db),
):
    """Update tournament fields.

    :param tournament_id: Tournament primary key.
    :param payload: Fields to update (partial update).
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


@router.delete("/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tournament(tournament_id: int, db: Session = Depends(get_db)):
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
# Single-elimination bracket generation
# ---------------------------------------------------------------------------
def _build_bracket(team_ids: List[int]) -> Dict:
    """Build a single-elimination bracket tree using the "bye seeding" method.

    :param team_ids: Ordered list of team ids (rank/seed order).
    :return: A nested dict describing the bracket (``rounds``, ``slots``).
    """
    n = len(team_ids)
    if n < 2:
        raise ValueError("Bracket generation requires at least 2 teams.")

    # Number of teams in the first round after adding byes = next power of 2.
    next_power = 1 << math.ceil(math.log2(n))
    byes = next_power - n
    # Standard seeding pattern for single-elimination brackets.
    seeds = list(range(1, n + 1)) + [None] * byes  # None = bye

    order = [seeds[0]]
    i = 1
    while len(order) < len(seeds):
        step = 1 << i
        new_order = []
        for pos in range(0, len(order), 1):
            # Reorder into the classic bracket pair sequence.
            pass
        # Simple alternating expansion:
        new_order = []
        for idx, val in enumerate(order):
            mirror = seeds[min(len(seeds) - 1, len(seeds) - 1 - idx)] if idx < len(seeds) else None
            new_order.append(val)
            new_order.append(mirror)
        order = new_order[: len(seeds)]
        i += 1
        if i > len(seeds) + 1:
            break

    # Build first-round pairings; byes advance automatically.
    slots: List[Dict] = []
    for idx in range(0, len(order), 2):
        left = order[idx]
        right = order[idx + 1] if idx + 1 < len(order) else None
        slot = {
            "matchup": idx // 2 + 1,
            "team_a_id": None if left is None else (team_ids[left - 1] if left is not None else None),
            "team_b_id": None if right is None else (team_ids[right - 1] if right is not None else None),
            "is_bye": left is None or right is None,
            "winner_advances_to": None,
        }
        slots.append(slot)

    total_rounds = int(math.log2(next_power))
    return {
        "bracket_type": "single_elimination",
        "team_count": n,
        "byes": byes,
        "total_rounds": total_rounds,
        "first_round_slots": slots,
        "note": "Byes are represented as a None team id; winners advance automatically.",
    }


@router.post("/{tournament_id}/bracket", response_model=Dict)
def generate_bracket(
    tournament_id: int,
    persist: bool = Query(False, description="Persist first-round games as rows."),
    db: Session = Depends(get_db),
):
    """Generate a single-elimination bracket for a tournament.

    Uses the current set of teams in the tournament, ordered by name.

    :param tournament_id: Tournament primary key.
    :param persist: When True, also create first-round ``Game`` rows.
    :param db: SQLAlchemy session.
    :return: Bracket structure (and created games if ``persist=True``).
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    team_ids = [team.id for team in tournament.teams]
    if len(team_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 teams are required to generate a bracket.",
        )
    try:
        bracket = _build_bracket(team_ids)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    created_games: List[int] = []
    if persist:
        try:
            for slot in bracket["first_round_slots"]:
                if slot["is_bye"]:
                    continue
                game = models.Game(
                    tournament_id=tournament_id,
                    home_team_id=slot["team_a_id"],
                    away_team_id=slot["team_b_id"],
                    game_rule=models.GameRuleEnum.TIME_LIMIT,
                    time_limit=20,
                    field_number=None,
                )
                db.add(game)
            db.commit()
            # Collect ids of newly created games.
            created_games = [
                game.id
                for game in db.query(models.Game)
                .filter(models.Game.tournament_id == tournament_id)
                .filter(models.Game.start_time.is_(None))
                .all()
            ]
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not persist bracket games: {str(exc)}",
            ) from exc

    return {"bracket": bracket, "persisted_games": created_games}


# ---------------------------------------------------------------------------
# Round-robin generation
# ---------------------------------------------------------------------------
def _round_robin_pairs(team_ids: List[int]) -> List[Dict]:
    """Generate round-robin fixtures using the circle method.

    With an odd number of teams, one team gets a bye each round.

    :param team_ids: List of team ids.
    :return: A list of rounds; each round contains matchup dicts.
    """
    n = len(team_ids)
    if n < 2:
        raise ValueError("Round-robin generation requires at least 2 teams.")

    teams = list(team_ids)
    if n % 2 == 1:
        teams.append(None)  # placeholder for the bye
    rounds_count = len(teams) - 1
    pairings_per_round = len(teams) // 2

    rounds: List[Dict] = []
    for rnd in range(rounds_count):
        round_matches: List[Dict] = []
        for i in range(pairings_per_round):
            home = teams[i]
            away = teams[-(i + 1)]
            if home is None or away is None:
                continue  # this round's bye
            round_matches.append(
                {
                    "round": rnd + 1,
                    "home_team_id": home,
                    "away_team_id": away,
                }
            )
        rounds.append({"round": rnd + 1, "matches": round_matches, "bye": None})

        # Rotate all but the first element (circle method).
        teams = [teams[0]] + teams[-1:] + teams[1:-1]
    return rounds


@router.post("/{tournament_id}/round-robin", response_model=Dict)
def generate_round_robin(
    tournament_id: int,
    persist: bool = Query(False, description="Persist all fixtures as Game rows."),
    db: Session = Depends(get_db),
):
    """Generate a round-robin schedule for the tournament's teams.

    :param tournament_id: Tournament primary key.
    :param persist: When True, create ``Game`` rows for every non-bye matchup.
    :param db: SQLAlchemy session.
    :return: Rounds with matchups (and persisted game ids if applicable).
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    team_ids = [team.id for team in tournament.teams]
    if len(team_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 teams are required to generate a round-robin.",
        )
    try:
        rounds = _round_robin_pairs(team_ids)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    persisted_games: List[int] = []
    if persist:
        try:
            for rnd in rounds:
                for match in rnd["matches"]:
                    game = models.Game(
                        tournament_id=tournament_id,
                        home_team_id=match["home_team_id"],
                        away_team_id=match["away_team_id"],
                        game_rule=models.GameRuleEnum.TIME_LIMIT,
                        time_limit=20,
                        field_number=None,
                    )
                    db.add(game)
            db.commit()
            persisted_games = [
                game.id
                for game in db.query(models.Game)
                .filter(models.Game.tournament_id == tournament_id)
                .filter(models.Game.start_time.is_(None))
                .all()
            ]
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not persist round-robin games: {str(exc)}",
            ) from exc

    return {"rounds": rounds, "persisted_games": persisted_games}


# ---------------------------------------------------------------------------
# Schedule suggestion (field-aware)
# ---------------------------------------------------------------------------
@router.post("/{tournament_id}/schedule-suggestion", response_model=Dict)
def suggest_schedule(
    tournament_id: int,
    field_count: int = Query(..., ge=1, description="Number of available fields."),
    minutes_per_game: int = Query(30, ge=5, le=180),
    start_time: Optional[datetime] = Query(
        None, description="First slot time (defaults to tournament start_date)."
    ),
    db: Session = Depends(get_db),
):
    """Suggest a match schedule given the number of available fields.

    Distributes the tournament's (uncompleted, unscheduled) games across the
    available fields in time slots, honoring ``field_count`` concurrency.

    :param tournament_id: Tournament primary key.
    :param field_count: Number of fields that can host games simultaneously.
    :param minutes_per_game: Duration of each game slot in minutes.
    :param start_time: Optional first-slot timestamp (defaults to start_date).
    :param db: SQLAlchemy session.
    :return: Suggested schedule with field, start/end time per game.
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    games = (
        db.query(models.Game)
        .filter(models.Game.tournament_id == tournament_id)
        .filter(models.Game.is_completed.is_(False))
        .order_by(models.Game.id.asc())
        .all()
    )
    if not games:
        return {
            "tournament_id": tournament_id,
            "field_count": field_count,
            "schedule": [],
            "message": "No pending games to schedule.",
        }

    anchor = start_time or tournament.start_date
    if anchor is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament has no start_date and no start_time was provided.",
        )

    schedule: List[Dict] = []
    current_slot = anchor
    for idx, game in enumerate(games):
        field_number = (idx % field_count) + 1
        slot_start = current_slot + timedelta(minutes=minutes_per_game * (idx // field_count))
        slot_end = slot_start + timedelta(minutes=minutes_per_game)
        schedule.append(
            {
                "game_id": game.id,
                "field_number": field_number,
                "scheduled_start": slot_start,
                "scheduled_end": slot_end,
                "home_team_id": game.home_team_id,
                "away_team_id": game.away_team_id,
            }
        )

    return {
        "tournament_id": tournament_id,
        "field_count": field_count,
        "minutes_per_game": minutes_per_game,
        "total_slots": len(schedule),
        "schedule": schedule,
    }

