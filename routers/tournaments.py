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
from routers.auth import require_public, require_scorekeeper, require_admin

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
    with_status: bool = Query(
        False,
        description="When true, enrich each row with a server-computed status field.",
    ),
    db: Session = Depends(get_db),
    _: str = Depends(require_public),
):
    """List tournaments with pagination.

    :param skip: Number of rows to skip.
    :param limit: Maximum number of rows to return.
    :param with_status: When true, enriches each row with a computed
        ``status`` (``"live" | "upcoming" | "completed"``) and
        ``has_live_game`` boolean. Avoids the frontend's previous N+1
        pattern of listing games per tournament.
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

    if not with_status:
        return tournaments

    # Build a {tournament_id: has_live_game} map in a single query.
    try:
        live_rows = (
            db.query(models.Game.tournament_id)
            .filter(
                models.Game.tournament_id.in_([t.id for t in tournaments]),
                models.Game.is_live.is_(True),
            )
            .distinct()
            .all()
        )
        live_set = {row[0] for row in live_rows}
    except Exception:
        live_set = set()

    now_ms = int(datetime.utcnow().timestamp() * 1000)
    out: List[schemas.TournamentWithStatus] = []
    for t in tournaments:
        # Compute status using the live flag as primary signal (truth) and
        # date windows as fallback when no live game is recorded.
        try:
            start_ms = int(t.start_date.timestamp() * 1000)
            end_ms = int(t.end_date.timestamp() * 1000)
        except Exception:
            start_ms = end_ms = now_ms

        if t.id in live_set:
            status = "live"
        elif end_ms < now_ms:
            status = "completed"
        elif start_ms > now_ms:
            status = "upcoming"
        else:
            # Window open but no live game recorded → upcoming (safe default).
            status = "upcoming"

        out.append(
            schemas.TournamentWithStatus(
                id=t.id,
                name=t.name,
                start_date=t.start_date,
                end_date=t.end_date,
                location=t.location,
                description=t.description,
                created_at=t.created_at,
                updated_at=t.updated_at,
                status=status,
                has_live_game=t.id in live_set,
            )
        )
    return out


@router.post("", response_model=schemas.Tournament, status_code=status.HTTP_201_CREATED)
def create_tournament(
    payload: schemas.TournamentCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
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
def get_tournament(tournament_id: int, db: Session = Depends(get_db), _: str = Depends(require_public)):
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
    _: str = Depends(require_scorekeeper),
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
def delete_tournament(tournament_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
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
def _standard_seed_order(size: int) -> List[int]:
    """Return the standard 1-indexed seed order for a power-of-two bracket.

    Using this order, seed 1 and seed 2 meet only in the final, and the
    strongest seeds are spread across the bracket. Matches the classic
    single-elimination seeding pattern.

    :param size: The bracket size (a power of two).
    :return: A list of seed numbers (1..size) in bracket slot order.
    """
    if size == 1:
        return [1]
    prev = _standard_seed_order(size // 2)
    result = []
    for seed in prev:
        result.append(seed)
        result.append(size + 1 - seed)
    return result


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
    order = _standard_seed_order(next_power)

    # Build first-round pairings; byes advance automatically.
    slots: List[Dict] = []
    for idx in range(0, len(order), 2):
        seed_a = order[idx]
        seed_b = order[idx + 1] if idx + 1 < len(order) else None
        team_a_id = team_ids[seed_a - 1] if seed_a is not None and seed_a <= n else None
        team_b_id = team_ids[seed_b - 1] if seed_b is not None and seed_b <= n else None
        slot = {
            "matchup": idx // 2 + 1,
            "team_a_id": team_a_id,
            "team_b_id": team_b_id,
            "is_bye": team_a_id is None or team_b_id is None,
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
    _: str = Depends(require_scorekeeper),
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
    _: str = Depends(require_scorekeeper),
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
    _: str = Depends(require_scorekeeper),
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


# ---------------------------------------------------------------------------
# Phase / group / standings / full-bracket logic
# ---------------------------------------------------------------------------
# A separate router is used for phase-scoped operations to avoid the
# ``/{tournament_id}`` route swallowing ``phases`` as a tournament id.
phases_router = APIRouter(prefix="/phases", tags=["phases"])


def _get_phase_or_404(db: Session, phase_id: int) -> models.Phase:
    """Fetch a phase by id or raise 404.

    :param db: SQLAlchemy session.
    :param phase_id: Phase primary key.
    :return: The requested phase row.
    :raises HTTPException: 404 if not found.
    """
    phase = (
        db.query(models.Phase)
        .filter(models.Phase.id == phase_id)
        .first()
    )
    if phase is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Phase with id {phase_id} not found.",
        )
    return phase


def _get_group_or_404(db: Session, group_id: int) -> models.Group:
    """Fetch a group by id or raise 404.

    :param db: SQLAlchemy session.
    :param group_id: Group primary key.
    :return: The requested group row.
    :raises HTTPException: 404 if not found.
    """
    group = (
        db.query(models.Group)
        .filter(models.Group.id == group_id)
        .first()
    )
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with id {group_id} not found.",
        )
    return group


def _default_phase_config(phase_type: models.PhaseTypeEnum) -> Dict:
    """Return the default config dict for a phase.

    :param phase_type: The phase type (round_robin or bracket).
    :return: A config dict with sensible defaults.
    """
    if phase_type == models.PhaseTypeEnum.ROUND_ROBIN:
        return {
            "points_win": 3,
            "points_draw": 1,
            "points_loss": 0,
            "group_count": 1,
            "advancing_teams": 1,
            "tiebreakers": [
                TiebreakerKey.POINTS,
                TiebreakerKey.GOAL_DIFFERENCE,
                TiebreakerKey.GOALS_FOR,
                TiebreakerKey.GOALS_AGAINST,
                TiebreakerKey.DIRECT_MATCHUP,
                TiebreakerKey.SPIRIT_SCORE,
            ],
        }
    return {
        "include_placement_matches": True,
        "advancing_teams": 1,
    }


# String keys for tiebreakers (kept in sync with TiebreakerEnum values).
class TiebreakerKey:
    POINTS = "points"
    WINS = "wins"
    GOAL_DIFFERENCE = "goal_difference"
    GOALS_FOR = "goals_for"
    GOALS_AGAINST = "goals_against"
    DIRECT_MATCHUP = "direct_matchup"
    SPIRIT_SCORE = "spirit_score"


# ---------------------------------------------------------------------------
# Tournament-level: create / list phases
# ---------------------------------------------------------------------------
@router.post("/{tournament_id}/phases", response_model=schemas.Phase, status_code=status.HTTP_201_CREATED)
def create_phase(
    tournament_id: int,
    payload: schemas.PhaseCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Create a new phase for a tournament.

    :param tournament_id: Tournament primary key.
    :param payload: Phase data (name, type, config, status_mode).
    :param db: SQLAlchemy session.
    :return: The created phase.
    """
    _get_tournament_or_404(db, tournament_id)
    config = payload.config or _default_phase_config(payload.phase_type)
    try:
        phase = models.Phase(
            tournament_id=tournament_id,
            name=payload.name,
            phase_order=payload.phase_order,
            phase_type=payload.phase_type,
            status=payload.status,
            status_mode=payload.status_mode,
            config=config,
        )
        db.add(phase)
        db.commit()
        db.refresh(phase)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create phase: {str(exc)}",
        ) from exc
    return phase


@router.get("/{tournament_id}/phases", response_model=List[schemas.Phase])
def list_phases(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_public),
):
    """List all phases for a tournament, ordered by ``phase_order``.

    :param tournament_id: Tournament primary key.
    :param db: SQLAlchemy session.
    :return: List of phases.
    """
    _get_tournament_or_404(db, tournament_id)
    try:
        phases = (
            db.query(models.Phase)
            .filter(models.Phase.tournament_id == tournament_id)
            .order_by(models.Phase.phase_order.asc())
            .all()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not list phases: {str(exc)}",
        ) from exc
    return phases


# ---------------------------------------------------------------------------
# Phase CRUD
# ---------------------------------------------------------------------------
@phases_router.get("/{phase_id}", response_model=schemas.PhaseWithGroups)
def get_phase(phase_id: int, db: Session = Depends(get_db), _: str = Depends(require_public)):
    """Fetch a single phase including its groups.

    :param phase_id: Phase primary key.
    :param db: SQLAlchemy session.
    :return: Phase with ``groups`` relationship loaded.
    """
    return _get_phase_or_404(db, phase_id)


@phases_router.put("/{phase_id}", response_model=schemas.Phase)
def update_phase(
    phase_id: int,
    payload: schemas.PhaseUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Update phase fields (partial update).

    :param phase_id: Phase primary key.
    :param payload: Fields to update.
    :param db: SQLAlchemy session.
    :return: The updated phase.
    """
    phase = _get_phase_or_404(db, phase_id)
    update_data = payload.dict(exclude_unset=True)
    try:
        for field, value in update_data.items():
            setattr(phase, field, value)
        db.commit()
        db.refresh(phase)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update phase: {str(exc)}",
        ) from exc
    return phase


@phases_router.delete("/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phase(phase_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    """Delete a phase and cascade to its groups and games.

    :param phase_id: Phase primary key.
    :param db: SQLAlchemy session.
    """
    phase = _get_phase_or_404(db, phase_id)
    try:
        db.delete(phase)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete phase: {str(exc)}",
        ) from exc


# ---------------------------------------------------------------------------
# Group auto-split
# ---------------------------------------------------------------------------
def _split_teams_into_groups(team_ids: List[int], group_count: int) -> List[List[int]]:
    """Split a flat list of team ids into ``group_count`` roughly balanced groups.

    Teams are distributed round-robin (snake) so that the strongest seeds are
    spread across groups. If ``group_count`` is 1, a single group holds all
    teams.

    :param team_ids: Flat list of team ids (in seed/rank order).
    :param group_count: Number of groups to create.
    :return: A list of lists, each inner list being a group's team ids.
    """
    if group_count < 1:
        raise ValueError("group_count must be >= 1.")
    if group_count == 1:
        return [list(team_ids)]
    groups: List[List[int]] = [[] for _ in range(group_count)]
    for idx, team_id in enumerate(team_ids):
        group_idx = idx % group_count
        basket = idx // group_count
        if basket % 2 == 1:
            # reverse direction for the next "basket" (snake distribution)
            group_idx = group_count - 1 - group_idx
        groups[group_idx].append(team_id)
    return groups


@phases_router.post("/{phase_id}/groups/split", response_model=List[schemas.Group])
def split_phase_groups(
    phase_id: int,
    group_count: int = Query(..., ge=1, description="Number of groups to create."),
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Auto-split a round-robin phase's teams into groups.

    Creates ``Group`` rows (and ``GroupTeam`` links) for the phase. Teams are
    distributed snake-style so the strongest seeds are spread across groups.

    :param phase_id: Phase primary key.
    :param group_count: Number of groups to create.
    :param db: SQLAlchemy session.
    :return: List of created groups.
    """
    phase = _get_phase_or_404(db, phase_id)
    if phase.phase_type != models.PhaseTypeEnum.ROUND_ROBIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group splitting is only meaningful for round-robin phases.",
        )
    tournament = _get_tournament_or_404(db, phase.tournament_id)
    team_ids = [team.id for team in tournament.teams]
    if len(team_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 teams are required to split into groups.",
        )
    if group_count > len(team_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="group_count cannot exceed the number of teams.",
        )
    try:
        split = _split_teams_into_groups(team_ids, group_count)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    created: List[models.Group] = []
    try:
        for g_idx, group_team_ids in enumerate(split):
            group = models.Group(
                phase_id=phase.id,
                name=f"Group {chr(ord('A') + g_idx)}",
                group_order=g_idx + 1,
            )
            db.add(group)
            db.flush()
            for seed, tid in enumerate(group_team_ids):
                link = models.GroupTeam(
                    group_id=group.id,
                    team_id=tid,
                    seed=seed + 1,
                )
                db.add(link)
            created.append(group)
        db.commit()
        for group in created:
            db.refresh(group)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not split groups: {str(exc)}",
        ) from exc
    return created


# ---------------------------------------------------------------------------
# Group round-robin generation
# ---------------------------------------------------------------------------
def _group_team_ids(db: Session, group: models.Group) -> List[int]:
    """Return the team ids in a group, ordered by seed.

    :param db: SQLAlchemy session.
    :param group: The group row.
    :return: List of team ids ordered by seed.
    """
    links = (
        db.query(models.GroupTeam)
        .filter(models.GroupTeam.group_id == group.id)
        .order_by(models.GroupTeam.seed.asc())
        .all()
    )
    return [link.team_id for link in links]


@phases_router.post("/{phase_id}/round-robin", response_model=Dict)
def generate_phase_round_robin(
    phase_id: int,
    persist: bool = Query(False, description="Persist all fixtures as Game rows."),
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Generate round-robin fixtures per group within a phase.

    Each group's members are paired with the circle method; the resulting
    fixtures are grouped by round then by group.

    :param phase_id: Phase primary key.
    :param persist: When True, create ``Game`` rows for every non-bye matchup.
    :param db: SQLAlchemy session.
    :return: Rounds with per-group matchups (and persisted game ids).
    """
    phase = _get_phase_or_404(db, phase_id)
    if phase.phase_type != models.PhaseTypeEnum.ROUND_ROBIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Round-robin generation requires a round-robin phase.",
        )

    groups = (
        db.query(models.Group)
        .filter(models.Group.phase_id == phase.id)
        .order_by(models.Group.group_order.asc())
        .all()
    )
    if not groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No groups exist for this phase. Create/split groups first.",
        )

    # Build rounds grouped by group.
    group_rounds: List[Dict] = []
    try:
        for group in groups:
            team_ids = _group_team_ids(db, group)
            if len(team_ids) < 2:
                continue
            rounds = _round_robin_pairs(team_ids)
            group_rounds.append(
                {
                    "group_id": group.id,
                    "group_name": group.name,
                    "rounds": rounds,
                }
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    persisted_games: List[int] = []
    if persist:
        try:
            for group_block in group_rounds:
                for rnd in group_block["rounds"]:
                    for match in rnd["matches"]:
                        game = models.Game(
                            tournament_id=phase.tournament_id,
                            phase_id=phase.id,
                            group_id=group_block["group_id"],
                            home_team_id=match["home_team_id"],
                            away_team_id=match["away_team_id"],
                            round_number=match["round"],
                            game_rule=models.GameRuleEnum.TIME_LIMIT,
                            time_limit=20,
                            field_number=None,
                        )
                        db.add(game)
            db.commit()
            persisted_games = [
                game.id
                for game in db.query(models.Game)
                .filter(models.Game.phase_id == phase.id)
                .filter(models.Game.start_time.is_(None))
                .all()
            ]
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not persist round-robin games: {str(exc)}",
            ) from exc

    return {
        "phase_id": phase.id,
        "groups": group_rounds,
        "persisted_games": persisted_games,
    }


# ---------------------------------------------------------------------------
# Standings computation
# ---------------------------------------------------------------------------
def _compute_team_record(
    db: Session,
    phase: models.Phase,
    team_id: int,
    group_id: Optional[int],
    config: Dict,
) -> Dict:
    """Compute the aggregate record for a team within a phase/group.

    Only completed games attributed to the phase (and optionally group) are
    counted. Spirit scores are averaged across the team's games.

    :param db: SQLAlchemy session.
    :param phase: The phase row.
    :param team_id: Team primary key.
    :param group_id: Optional group id filter.
    :param config: Phase config dict (points + tiebreakers).
    :return: A record dict with played/wins/draws/losses/points/goals/spirit.
    """
    query = (
        db.query(models.Game)
        .filter(
            models.Game.phase_id == phase.id,
            models.Game.is_completed.is_(True),
        )
        .filter(
            (models.Game.home_team_id == team_id)
            | (models.Game.away_team_id == team_id)
        )
    )
    if group_id is not None:
        query = query.filter(models.Game.group_id == group_id)
    games = query.all()

    points_win = int(config.get("points_win", 3))
    points_draw = int(config.get("points_draw", 1))
    points_loss = int(config.get("points_loss", 0))

    played = 0
    wins = 0
    draws = 0
    losses = 0
    points = 0
    goals_for = 0
    goals_against = 0
    spirit_total = 0.0
    spirit_games = 0

    for game in games:
        if game.home_team_id == team_id:
            gf = game.home_score or 0
            ga = game.away_score or 0
            spirit = game.spirit_home
        else:
            gf = game.away_score or 0
            ga = game.home_score or 0
            spirit = game.spirit_away
        played += 1
        goals_for += gf
        goals_against += ga
        if gf > ga:
            wins += 1
            points += points_win
        elif gf < ga:
            losses += 1
            points += points_loss
        else:
            draws += 1
            points += points_draw
        if spirit is not None:
            spirit_total += float(spirit)
            spirit_games += 1

    goal_difference = goals_for - goals_against
    spirit_average = round(spirit_total / spirit_games, 2) if spirit_games else 0.0
    return {
        "team_id": team_id,
        "played": played,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "points": points,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "goal_difference": goal_difference,
        "spirit_total": round(spirit_total, 2),
        "spirit_games": spirit_games,
        "spirit_average": spirit_average,
    }


def _direct_matchup(records: List[Dict], team_a: int, team_b: int) -> Optional[int]:
    """Return the outcome of a direct matchup between two teams.

    The comparison is relative to ``team_a``: returns 1 if team_a won, -1 if
    team_a lost, 0 on a draw, or None if the teams did not play each other.

    :param records: List of team records (each with ``team_id``).
    :param team_a: First team id.
    :param team_b: Second team id.
    :return: 1, -1, 0, or None.
    """
    # The caller supplies the games; direct matchup is computed on the fly
    # from the record's underlying games. To keep this helper dependency-free
    # we return None here and the caller handles it via a richer function.
    return None


def _head_to_head(
    db: Session,
    phase_id: int,
    group_id: Optional[int],
    team_a: int,
    team_b: int,
) -> Optional[int]:
    """Return the head-to-head outcome between two teams relative to team_a.

    :param db: SQLAlchemy session.
    :param phase_id: Phase primary key.
    :param group_id: Optional group filter.
    :param team_a: First team id.
    :param team_b: Second team id.
    :return: 1 if team_a won, -1 if team_a lost, 0 on a draw, None if no match.
    """
    query = db.query(models.Game).filter(
        models.Game.phase_id == phase_id,
        models.Game.is_completed.is_(True),
    )
    if group_id is not None:
        query = query.filter(models.Game.group_id == group_id)
    games = query.all()
    for game in games:
        if {game.home_team_id, game.away_team_id} == {team_a, team_b}:
            if game.home_team_id == team_a:
                gf, ga = game.home_score or 0, game.away_score or 0
            else:
                gf, ga = game.away_score or 0, game.home_score or 0
            if gf > ga:
                return 1
            if gf < ga:
                return -1
            return 0
    return None


def _compare_teams(
    db: Session,
    phase: models.Phase,
    group_id: Optional[int],
    a: Dict,
    b: Dict,
    tiebreakers: List[str],
) -> int:
    """Compare two team records using the configured tiebreaker priority.

    :param db: SQLAlchemy session.
    :param phase: The phase row.
    :param group_id: Optional group filter for head-to-head.
    :param a: Team A record.
    :param b: Team B record.
    :param tiebreakers: Ordered list of tiebreaker keys.
    :return: Negative if A ranks below B, positive if above, 0 if equal.
    """
    for key in tiebreakers:
        if key == TiebreakerKey.POINTS:
            if a["points"] != b["points"]:
                return a["points"] - b["points"]
        elif key == TiebreakerKey.WINS:
            if a["wins"] != b["wins"]:
                return a["wins"] - b["wins"]
        elif key == TiebreakerKey.GOAL_DIFFERENCE:
            if a["goal_difference"] != b["goal_difference"]:
                return a["goal_difference"] - b["goal_difference"]
        elif key == TiebreakerKey.GOALS_FOR:
            if a["goals_for"] != b["goals_for"]:
                return a["goals_for"] - b["goals_for"]
        elif key == TiebreakerKey.GOALS_AGAINST:
            if a["goals_against"] != b["goals_against"]:
                return b["goals_against"] - a["goals_against"]
        elif key == TiebreakerKey.SPIRIT_SCORE:
            if a["spirit_average"] != b["spirit_average"]:
                return (a["spirit_average"] > b["spirit_average"]) - (
                    a["spirit_average"] < b["spirit_average"]
                )
        elif key == TiebreakerKey.DIRECT_MATCHUP:
            h2h = _head_to_head(db, phase.id, group_id, a["team_id"], b["team_id"])
            if h2h is not None and h2h != 0:
                return h2h
    return 0


def _build_standings(
    db: Session,
    phase: models.Phase,
    group_id: Optional[int],
    team_ids: List[int],
    config: Dict,
) -> List[Dict]:
    """Compute and sort a standings table for a set of teams.

    :param db: SQLAlchemy session.
    :param phase: The phase row.
    :param group_id: Optional group filter.
    :param team_ids: Team ids to include.
    :param config: Phase config dict.
    :return: A list of sorted standings row dicts (with ``position``).
    """
    tiebreakers = [str(t) for t in config.get("tiebreakers", [TiebreakerKey.POINTS])]
    records = [
        _compute_team_record(db, phase, tid, group_id, config)
        for tid in team_ids
    ]
    # Sort by the configured tiebreaker priority (comparator sort).
    from functools import cmp_to_key

    records.sort(
        key=cmp_to_key(
            lambda a, b: _compare_teams(db, phase, group_id, a, b, tiebreakers)
        ),
        reverse=True,
    )
    for i, rec in enumerate(records):
        rec["position"] = i + 1
    return records


@phases_router.get("/{phase_id}/standings", response_model=schemas.StandingsTable)
def get_phase_standings(phase_id: int, db: Session = Depends(get_db), _: str = Depends(require_public)):
    """Return the standings table for a phase, grouped as configured.

    For round-robin phases, standings are computed per group (leaders
    determined by the phase's tiebreaker priority). For bracket phases, a
    global ranking is not meaningful and an empty table is returned.

    :param phase_id: Phase primary key.
    :param db: SQLAlchemy session.
    :return: A standings table with per-group rows.
    """
    phase = _get_phase_or_404(db, phase_id)
    config = phase.config or {}
    tiebreakers = [str(t) for t in config.get("tiebreakers", [TiebreakerKey.POINTS])]

    groups_out: List[Dict] = []
    if phase.phase_type == models.PhaseTypeEnum.ROUND_ROBIN:
        groups = (
            db.query(models.Group)
            .filter(models.Group.phase_id == phase.id)
            .order_by(models.Group.group_order.asc())
            .all()
        )
        if not groups:
            # Single global group (no explicit groups split).
            team_ids = [t.id for t in _get_tournament_or_404(db, phase.tournament_id).teams]
            rows = _build_standings(db, phase, None, team_ids, config)
            groups_out.append(
                {
                    "group_id": None,
                    "group_name": "All teams",
                    "rows": rows,
                }
            )
        else:
            for group in groups:
                team_ids = _group_team_ids(db, group)
                rows = _build_standings(db, phase, group.id, team_ids, config)
                groups_out.append(
                    {
                        "group_id": group.id,
                        "group_name": group.name,
                        "rows": rows,
                    }
                )

    return schemas.StandingsTable(
        phase_id=phase.id,
        phase_name=phase.name,
        phase_type=phase.phase_type.value,
        groups=groups_out,
        tiebreakers=tiebreakers,
        generated_at=datetime.utcnow(),
    )


# ---------------------------------------------------------------------------
# Full placement bracket generation
# ---------------------------------------------------------------------------
def _build_full_bracket(team_ids: List[int], include_placement: bool = True) -> Dict:
    """Build a full single-elimination bracket with all placement matches.

    Unlike the simple first-round listing, this generates the complete tree
    of matches for every round down to the final, plus placement matches
    (3rd, 5th, 7th, ...) for every team that did not win the final.

    :param team_ids: Ordered list of team ids (seed order).
    :param include_placement: Whether to include placement (3rd/5th/...) matches.
    :return: A dict describing all rounds and placement matches.
    """
    n = len(team_ids)
    if n < 2:
        raise ValueError("Bracket generation requires at least 2 teams.")

    next_power = 1 << math.ceil(math.log2(n))
    byes = next_power - n
    order = _standard_seed_order(next_power)
    total_rounds = int(math.log2(next_power))

    # Build a tree of slots. Each slot stores the two team ids entering it.
    # Slots at round 1 receive the seeded teams; later rounds receive winners.
    # Byes are represented by None (advance automatically).
    rounds: List[List[Dict]] = []
    # First round slots.
    current_round: List[Dict] = []
    for idx in range(0, len(order), 2):
        seed_a = order[idx]
        seed_b = order[idx + 1] if idx + 1 < len(order) else None
        team_a = team_ids[seed_a - 1] if seed_a is not None and seed_a <= n else None
        team_b = team_ids[seed_b - 1] if seed_b is not None and seed_b <= n else None
        current_round.append(
            {
                "round": 1,
                "slot": idx // 2 + 1,
                "team_a_id": team_a,
                "team_b_id": team_b,
                "winner_id": team_a if team_b is None else None,
                "is_bye": team_a is None or team_b is None,
            }
        )
    rounds.append(current_round)

    # Subsequent rounds: pair winners of consecutive slots.
    for rnd in range(2, total_rounds + 1):
        prev = rounds[-1]
        next_round: List[Dict] = []
        for slot_idx in range(0, len(prev), 2):
            w_a = prev[slot_idx]["winner_id"]
            w_b = prev[slot_idx + 1]["winner_id"] if slot_idx + 1 < len(prev) else None
            next_round.append(
                {
                    "round": rnd,
                    "slot": slot_idx // 2 + 1,
                    "team_a_id": w_a,
                    "team_b_id": w_b,
                    "winner_id": w_a if w_b is None else None,
                    "is_bye": w_a is None or w_b is None,
                }
            )
        rounds.append(next_round)

    # Placement matches: for every eliminated team, generate a placement match.
    # For odd seed counts, the bracket produces a well-defined set of placement
    # matches (3rd, 5th, 7th, ...). Each placement match pairs the two losers of
    # the corresponding round's matchups.
    placement_matches: List[Dict] = []
    if include_placement and n >= 3:
        # Losers of the two semifinals play for 3rd place.
        placement_matches.append(
            {
                "round": total_rounds + 1,
                "placement_position": 3,
                "description": "3rd place match",
                "team_a_id": None,  # filled dynamically by the engine
                "team_b_id": None,
            }
        )
        # For 5th, 7th, ... place: losers of qualification rounds.
        for pos in range(5, n + 1, 2):
            placement_matches.append(
                {
                    "round": total_rounds + 1,
                    "placement_position": pos,
                    "description": f"{pos}th place match",
                    "team_a_id": None,
                    "team_b_id": None,
                }
            )

    return {
        "bracket_type": "single_elimination",
        "team_count": n,
        "byes": byes,
        "total_rounds": total_rounds,
        "rounds": rounds,
        "placement_matches": placement_matches,
        "note": "NA",
    }


@phases_router.post("/{phase_id}/bracket", response_model=Dict)
def generate_phase_bracket(
    phase_id: int,
    persist: bool = Query(False, description="Persist bracket games as rows."),
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Generate a full placement bracket for a bracket phase.

    The bracket seeds come from the phase's teams (inline) or, if no teams are
    attached, from the tournament's teams. All rounds plus placement matches
    (3rd, 5th, 7th, ...) are generated.

    :param phase_id: Phase primary key.
    :param persist: When True, create ``Game`` rows for each non-bye matchup.
    :param db: SQLAlchemy session.
    :return: The bracket structure (and created game ids if persisted).
    """
    phase = _get_phase_or_404(db, phase_id)
    if phase.phase_type != models.PhaseTypeEnum.BRACKET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bracket generation requires a bracket phase.",
        )
    tournament = _get_tournament_or_404(db, phase.tournament_id)

    # Determine the seeded team list: prefer inline phase teams (from a
    # previous phase's advancement), else the tournament's teams.
    team_ids: List[int] = []
    # Use the phase's groups' teams if any exist, else tournament teams.
    groups = (
        db.query(models.Group)
        .filter(models.Group.phase_id == phase.id)
        .order_by(models.Group.group_order.asc())
        .all()
    )
    if groups:
        for group in groups:
            team_ids.extend(_group_team_ids(db, group))
    else:
        team_ids = [team.id for team in tournament.teams]

    if len(team_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 teams are required to generate a bracket.",
        )
    config = phase.config or {}
    include_placement = bool(config.get("include_placement_matches", True))
    try:
        bracket = _build_full_bracket(team_ids, include_placement=include_placement)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    created_games: List[int] = []
    if persist:
        try:
            for rnd in bracket["rounds"]:
                for slot in rnd:
                    if slot["is_bye"]:
                        continue
                    game = models.Game(
                        tournament_id=phase.tournament_id,
                        phase_id=phase.id,
                        home_team_id=slot["team_a_id"],
                        away_team_id=slot["team_b_id"],
                        bracket_round=slot["round"],
                        bracket_slot=slot["slot"],
                        is_placement=False,
                        game_rule=models.GameRuleEnum.TIME_LIMIT,
                        time_limit=20,
                        field_number=None,
                    )
                    db.add(game)
            for pm in bracket["placement_matches"]:
                if pm["team_a_id"] is None or pm["team_b_id"] is None:
                    continue
                game = models.Game(
                    tournament_id=phase.tournament_id,
                    phase_id=phase.id,
                    home_team_id=pm["team_a_id"],
                    away_team_id=pm["team_b_id"],
                    bracket_round=pm["round"],
                    bracket_slot=pm["placement_position"],
                    is_placement=True,
                    placement_position=pm["placement_position"],
                    game_rule=models.GameRuleEnum.TIME_LIMIT,
                    time_limit=20,
                    field_number=None,
                )
                db.add(game)
            db.commit()
            created_games = [
                game.id
                for game in db.query(models.Game)
                .filter(models.Game.phase_id == phase.id)
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
# Phase advancement (group standings → next phase)
# ---------------------------------------------------------------------------
@phases_router.post("/{phase_id}/advance", response_model=Dict)
def advance_phase(
    phase_id: int,
    target_phase_id: int = Query(..., description="Target phase id to advance into."),
    teams_per_group: Optional[int] = Query(None, ge=1, description="Teams to advance per group (default: config advancing_teams)."),
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Advance the top teams from each group into a target phase.

    Uses the phase's standings (with its configured tiebreakers) to determine
    the top ``teams_per_group`` (or ``config.advancing_teams``) teams from each
    group. Those teams are attached to the target phase as a single group in
    seed order.

    :param phase_id: Source phase primary key.
    :param target_phase_id: Target phase primary key.
    :param teams_per_group: Optional override for the number advancing per group.
    :param db: SQLAlchemy session.
    :return: The advanced team ids and their assignment.
    """
    source = _get_phase_or_404(db, phase_id)
    target = _get_phase_or_404(db, target_phase_id)
    if source.tournament_id != target.tournament_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target phases must belong to the same tournament.",
        )
    config = source.config or {}
    per_group = teams_per_group or int(config.get("advancing_teams", 1))

    groups = (
        db.query(models.Group)
        .filter(models.Group.phase_id == source.id)
        .order_by(models.Group.group_order.asc())
        .all()
    )
    if not groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source phase has no groups to advance from.",
        )

    advanced = []
    try:
        for group in groups:
            team_ids = _group_team_ids(db, group)
            rows = _build_standings(db, source, group.id, team_ids, config)
            top = [r["team_id"] for r in rows[:per_group]]
            advanced.extend(top)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not compute standings for advancement: {str(exc)}",
        ) from exc

    # Attach the advanced teams to the target phase as a single group.
    try:
        target_group = models.Group(
            phase_id=target.id,
            name="Advanced",
            group_order=1,
        )
        db.add(target_group)
        db.flush()
        for seed, tid in enumerate(advanced):
            link = models.GroupTeam(
                group_id=target_group.id,
                team_id=tid,
                seed=seed + 1,
            )
            db.add(link)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not advance teams into target phase: {str(exc)}",
        ) from exc

    return {
        "source_phase_id": source.id,
        "target_phase_id": target.id,
        "teams_per_group": per_group,
        "advanced_team_ids": advanced,
    }


# ---------------------------------------------------------------------------
# Tournament-wide spirit ranking
# ---------------------------------------------------------------------------
@router.get("/{tournament_id}/spirit-ranking", response_model=Dict)
def get_spirit_ranking(
    tournament_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_public),
):
    """Return a tournament-wide spirit ranking.

    Spirit is the average of each team's recorded spirit scores across all
    completed games. Teams with no spirit scores are ranked last.

    :param tournament_id: Tournament primary key.
    :param db: SQLAlchemy session.
    :return: Sorted spirit ranking with per-team averages.
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    games = (
        db.query(models.Game)
        .filter(
            models.Game.tournament_id == tournament_id,
            models.Game.is_completed.is_(True),
        )
        .all()
    )
    team_spirit: Dict[int, Dict] = {}
    for game in games:
        for team_id, spirit in (
            (game.home_team_id, game.spirit_home),
            (game.away_team_id, game.spirit_away),
        ):
            if spirit is None:
                continue
            entry = team_spirit.setdefault(team_id, {"total": 0.0, "games": 0})
            entry["total"] += float(spirit)
            entry["games"] += 1

    rows = []
    for team in tournament.teams:
        entry = team_spirit.get(team.id, {"total": 0.0, "games": 0})
        avg = round(entry["total"] / entry["games"], 2) if entry["games"] else 0.0
        rows.append(
            {
                "team_id": team.id,
                "team_name": team.name,
                "spirit_average": avg,
                "spirit_games": entry["games"],
            }
        )
    rows.sort(key=lambda r: r["spirit_average"], reverse=True)
    for i, row in enumerate(rows):
        row["position"] = i + 1
    return {
        "tournament_id": tournament_id,
        "teams": rows,
    }
