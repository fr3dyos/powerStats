"""Live game scoring and lifecycle endpoints.

Endpoints:

- CRUD for games.
- ``POST /games/{id}/events`` — record goal / assist / defense events
  (scoring events), with automatic score + ``player_tournament_stats`` updates.
- ``POST /games/{id}/timeout`` — start a timeout for a team.
- ``POST /games/{id}/end-timeout`` — end an active timeout.
- ``POST /games/{id}/advance-half`` — advance to the next half.
- ``POST /games/{id}/end`` — end the game by ``time_limit`` or
  ``score_limit`` rule.
- ``POST /games/{id}/void`` — mark the game as annulled (admin only).
- ``POST /games/{id}/forfeit`` — record a forfeit winner (admin only).

Timeout encoding: ``GameEvent.player_id`` is NOT NULL and is a foreign key
to ``players.id``, so team-level events (timeouts, half changes) use a
representative player from the team (the first player by id). ``points``
holds the timeout number (1 or 2) and ``event_type`` is ``timeout``.
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
import schemas
from routers.deps import get_db
from routers.auth import require_public, require_scorekeeper, require_admin

router = APIRouter(prefix="/games", tags=["games"])


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


def _get_player_or_404(db: Session, player_id: int) -> models.Player:
    """Fetch a real player by id or raise 404.

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


def _get_team_representative_player(db: Session, team_id: int) -> models.Player:
    """Return a representative player for a team (for team-level events).

    ``GameEvent.player_id`` is NOT NULL and references ``players.id``, so
    team-level events (timeouts, half changes) need a real player id. This
    helper returns the first player (by id) belonging to the team.

    :param db: SQLAlchemy session.
    :param team_id: Team primary key.
    :return: A Player belonging to the team.
    :raises HTTPException: 400 if the team has no players.
    """
    player = (
        db.query(models.Player)
        .filter(models.Player.team_id == team_id)
        .order_by(models.Player.id.asc())
        .first()
    )
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team {team_id} has no players; cannot record a team-level event.",
        )
    return player


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


def _ensure_not_completed(game: models.Game) -> None:
    """Raise 400 if the game is already completed.

    :param game: The game row.
    :raises HTTPException: 400 if ``game.is_completed`` is True.
    """
    if game.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is already completed.",
        )


def _get_or_create_player_stats(
    db: Session, player_id: int, tournament_id: int
) -> models.PlayerTournamentStats:
    """Fetch or create a player's tournament stats row.

    :param db: SQLAlchemy session.
    :param player_id: Player primary key.
    :param tournament_id: Tournament primary key.
    :return: The stats row (newly created if it did not exist).
    """
    stats = (
        db.query(models.PlayerTournamentStats)
        .filter(
            models.PlayerTournamentStats.player_id == player_id,
            models.PlayerTournamentStats.tournament_id == tournament_id,
        )
        .first()
    )
    if stats is None:
        stats = models.PlayerTournamentStats(
            player_id=player_id,
            tournament_id=tournament_id,
            games_played=0,
            goals=0,
            assists=0,
            defenses=0,
            goals_conceded=0,
        )
        db.add(stats)
        db.flush()
    return stats


def _current_period(game: models.Game, db: Session) -> int:
    """Derive the current half from the latest HALF event for the game.

    :param game: The game row.
    :param db: SQLAlchemy session.
    :return: 1 for first half, 2 for second half.
    """
    half_event = (
        db.query(models.GameEvent)
        .filter(
            models.GameEvent.game_id == game.id,
            models.GameEvent.event_type == models.GameEventTypeEnum.HALF,
        )
        .order_by(models.GameEvent.id.desc())
        .first()
    )
    if half_event is None:
        return 1
    return int(half_event.period or 1)


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------
@router.get("", response_model=List[schemas.Game])
def list_games(
    tournament_id: Optional[int] = None,
    is_completed: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: str = Depends(require_public),
):
    """List games with optional filters.

    :param tournament_id: Optional tournament id filter.
    :param is_completed: Optional completion filter.
    :param skip: Number of rows to skip.
    :param limit: Maximum rows to return.
    :param db: SQLAlchemy session.
    :return: List of games ordered by id.
    """
    try:
        query = db.query(models.Game)
        if tournament_id is not None:
            query = query.filter(models.Game.tournament_id == tournament_id)
        if is_completed is not None:
            query = query.filter(models.Game.is_completed.is_(is_completed))
        games = query.order_by(models.Game.id.asc()).offset(skip).limit(limit).all()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not list games: {str(exc)}",
        ) from exc
    return games


@router.post("", response_model=schemas.Game, status_code=status.HTTP_201_CREATED)
def create_game(payload: schemas.GameCreate, db: Session = Depends(get_db), _: str = Depends(require_scorekeeper)):
    """Create a new game.

    :param payload: Game data (tournament, teams, rule, limits, scores).
    :param db: SQLAlchemy session.
    :return: The created game.
    """
    _get_tournament_or_404(db, payload.tournament_id)
    _validate_game_payload(db, payload)
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


def _validate_game_payload(db: Session, payload: schemas.GameCreate) -> None:
    """Run the shared create-game validations (teams, rule/limits).

    :param db: SQLAlchemy session.
    :param payload: The game payload to validate.
    :raises HTTPException: 400 on invalid teams or missing limit values.
    """
    home = db.query(models.Team).filter(models.Team.id == payload.home_team_id).first()
    away = db.query(models.Team).filter(models.Team.id == payload.away_team_id).first()
    if home is None or away is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both home_team_id and away_team_id must reference existing teams.",
        )
    if payload.home_team_id == payload.away_team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A game cannot be scheduled between the same team.",
        )
    if payload.game_rule == models.GameRuleEnum.TIME_LIMIT and payload.time_limit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="time_limit is required when game_rule is TIME_LIMIT.",
        )
    if payload.game_rule == models.GameRuleEnum.SCORE_LIMIT and payload.score_limit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="score_limit is required when game_rule is SCORE_LIMIT.",
        )


@router.post("/batch", response_model=List[schemas.Game], status_code=status.HTTP_201_CREATED)
def create_games_batch(
    payload: schemas.GameBatchCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Create multiple games in one transaction (bulk scheduling / CSV upload).

    :param payload: A tournament id plus a list of game payloads.
    :param db: SQLAlchemy session.
    :return: The created games.
    """
    _get_tournament_or_404(db, payload.tournament_id)
    if not payload.games:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No games were provided.",
        )
    for game in payload.games:
        if game.tournament_id != payload.tournament_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Every game must belong to the batch tournament.",
            )
        _validate_game_payload(db, game)
    try:
        created = [models.Game(**game.dict()) for game in payload.games]
        db.add_all(created)
        db.commit()
        for game in created:
            db.refresh(game)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not create games: {str(exc)}",
        ) from exc
    return created


@router.get("/{game_id}", response_model=schemas.GameWithDetails)
def get_game(game_id: int, db: Session = Depends(get_db), _: str = Depends(require_public)):
    """Fetch a single game with team, tournament, and event details.

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    :return: Game with relationships loaded.
    """
    return _get_game_or_404(db, game_id)


@router.put("/{game_id}", response_model=schemas.Game)
def update_game(
    game_id: int,
    payload: schemas.GameUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Update game fields (partial update).

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


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(game_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    """Delete a game.

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
# Live scoring: record goal / assist / defense event
# ---------------------------------------------------------------------------
@router.post("/{game_id}/events", response_model=schemas.GameEvent)
def record_event(
    game_id: int,
    payload: schemas.GameEventCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Record a scoring event (goal / assist / defense) for a live game.

    Auto-updates the game score (for goals) and the involved players'
    ``player_tournament_stats`` aggregates.

    :param game_id: Game primary key.
    :param payload: Event data (player, type, points, time, period).
    :param db: SQLAlchemy session.
    :return: The created game event.
    """
    game = _get_game_or_404(db, game_id)
    _ensure_not_completed(game)

    if payload.event_type not in (
        models.GameEventTypeEnum.GOAL,
        models.GameEventTypeEnum.ASSIST,
        models.GameEventTypeEnum.DEFENSE,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /timeout, /advance-half, or /end for other event types.",
        )

    player = _get_player_or_404(db, payload.player_id)

    # Validate the player belongs to one of the two teams in this game.
    if player.team_id not in (game.home_team_id, game.away_team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player does not belong to either team in this game.",
        )

    period = payload.period or _current_period(game, db)
    # Guard the write path: never persist a negative elapsed time. The
    # response schema also clamps, but we prevent corrupt rows at the source.
    time_elapsed = max(payload.time_elapsed or 0, 0)

    try:
        event = models.GameEvent(
            game_id=game.id,
            player_id=player.id,
            event_type=payload.event_type,
            points=payload.points,
            time_elapsed=time_elapsed,
            period=period,
        )
        db.add(event)

        stats = _get_or_create_player_stats(db, player.id, game.tournament_id)
        stats.games_played = max(stats.games_played, period)  # at least current half
        if payload.event_type == models.GameEventTypeEnum.GOAL:
            stats.goals += 1
            if player.team_id == game.home_team_id:
                game.home_score += payload.points
            else:
                game.away_score += payload.points
        elif payload.event_type == models.GameEventTypeEnum.ASSIST:
            stats.assists += 1
        elif payload.event_type == models.GameEventTypeEnum.DEFENSE:
            stats.defenses += 1

        db.commit()
        db.refresh(event)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not record event: {str(exc)}",
        ) from exc
    return event


# ---------------------------------------------------------------------------
# Timeout management
# ---------------------------------------------------------------------------
@router.post("/{game_id}/timeout", response_model=schemas.GameEvent)
def start_timeout(
    game_id: int,
    team: str,
    timeout_number: int = 1,
    time_elapsed: Optional[int] = None,
    period: Optional[int] = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Start a timeout for a team in the current half.

    Each team may call up to 2 timeouts per half in Ultimate Frisbee; the
    caller provides ``timeout_number`` (1 or 2).

    :param game_id: Game primary key.
    :param team: Either ``home`` or ``away``.
    :param timeout_number: 1 or 2 (timeout ordinal for the current half).
    :param time_elapsed: Optional seconds elapsed from game start.
    :param period: Optional half (defaults to current half).
    :param db: SQLAlchemy session.
    :return: The created timeout game event.
    """
    game = _get_game_or_404(db, game_id)
    _ensure_not_completed(game)

    team = team.lower().strip()
    if team not in ("home", "away"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="team must be 'home' or 'away'.",
        )
    if timeout_number not in (1, 2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="timeout_number must be 1 or 2.",
        )

    team_id = game.home_team_id if team == "home" else game.away_team_id
    rep_player = _get_team_representative_player(db, team_id)
    player_id = rep_player.id
    current_period = period or _current_period(game, db)

    # Enforce max 2 timeouts per team per half.
    timeout_count = (
        db.query(models.GameEvent)
        .filter(
            models.GameEvent.game_id == game.id,
            models.GameEvent.event_type == models.GameEventTypeEnum.TIMEOUT,
            models.GameEvent.player_id == player_id,
            models.GameEvent.period == current_period,
        )
        .count()
    )
    if timeout_count >= 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{team.capitalize()} team has already used its 2 timeouts "
                   f"in half {current_period}.",
        )

    try:
        event = models.GameEvent(
            game_id=game.id,
            player_id=player_id,
            event_type=models.GameEventTypeEnum.TIMEOUT,
            points=timeout_number,
            time_elapsed=time_elapsed,
            period=current_period,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not start timeout: {str(exc)}",
        ) from exc
    return event


@router.post("/{game_id}/end-timeout", response_model=schemas.GameEvent)
def end_timeout(game_id: int, db: Session = Depends(get_db), _: str = Depends(require_scorekeeper)):
    """End the most recent active timeout.

    Because the schema has no explicit timeout state, this records a
    ``substitution`` event marked with ``points=99`` as the "timeout end"
    marker. This is a documented convention; consider extending the schema
    with a dedicated ``timeout_ended`` event type if needed.

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    :return: The created timeout-end marker event.
    """
    game = _get_game_or_404(db, game_id)
    _ensure_not_completed(game)

    latest_timeout = (
        db.query(models.GameEvent)
        .filter(
            models.GameEvent.game_id == game.id,
            models.GameEvent.event_type == models.GameEventTypeEnum.TIMEOUT,
        )
        .order_by(models.GameEvent.id.desc())
        .first()
    )
    if latest_timeout is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active timeout found for this game.",
        )

    try:
        marker = models.GameEvent(
            game_id=game.id,
            player_id=latest_timeout.player_id,
            event_type=models.GameEventTypeEnum.SUBSTITUTION,
            points=99,  # convention: timeout-end marker
            time_elapsed=latest_timeout.time_elapsed,
            period=latest_timeout.period,
        )
        db.add(marker)
        db.commit()
        db.refresh(marker)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not end timeout: {str(exc)}",
        ) from exc
    return marker


# ---------------------------------------------------------------------------
# Half advancement
# ---------------------------------------------------------------------------
@router.post("/{game_id}/advance-half", response_model=schemas.GameEvent)
def advance_half(
    game_id: int,
    time_elapsed: Optional[int] = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Advance the game to the next half.

    Records a HALF event with ``period`` set to the new half (1 -> 2).
    The game must not already be in the second half.

    :param game_id: Game primary key.
    :param time_elapsed: Optional seconds elapsed from game start.
    :param db: SQLAlchemy session.
    :return: The created HALF event.
    """
    game = _get_game_or_404(db, game_id)
    _ensure_not_completed(game)

    current_period = _current_period(game, db)
    if current_period >= 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is already in the second half.",
        )

    new_period = current_period + 1
    # Use a representative player from the home team for the half event.
    rep_player = _get_team_representative_player(db, game.home_team_id)
    try:
        event = models.GameEvent(
            game_id=game.id,
            player_id=rep_player.id,
            event_type=models.GameEventTypeEnum.HALF,
            points=0,
            time_elapsed=time_elapsed,
            period=new_period,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not advance half: {str(exc)}",
        ) from exc
    return event


# ---------------------------------------------------------------------------
# End game by time_limit or score_limit rule
# ---------------------------------------------------------------------------
@router.post("/{game_id}/end", response_model=schemas.Game)
def end_game(
    game_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """End the game, enforcing the configured rule.

    - ``TIME_LIMIT``: the game may be ended at any point; the caller is
      expected to have reached the time limit.
    - ``SCORE_LIMIT``: the game ends only when one team reaches/exceeds
      ``score_limit``. If neither team has, a 400 is returned.

    Marks ``is_completed=True`` and sets ``end_time`` to now.

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    :return: The updated game.
    """
    game = _get_game_or_404(db, game_id)
    _ensure_not_completed(game)

    if game.game_rule == models.GameRuleEnum.SCORE_LIMIT:
        limit = game.score_limit or 0
        reached = max(game.home_score, game.away_score) >= limit
        if not reached:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"score_limit rule requires one team to reach {limit} "
                    f"points (current {game.home_score}-{game.away_score})."
                ),
            )

    try:
        game.is_completed = True
        game.is_live = False
        game.clock_running = False
        game.clock_started_at = None
        game.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(game)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not end game: {str(exc)}",
        ) from exc
    return game


# ---------------------------------------------------------------------------
# Void / forfeit
# ---------------------------------------------------------------------------
class ForfeitRequest(BaseModel):
    """Body for ``POST /games/{id}/forfeit`` — the team declared winner."""

    winner_team_id: int = Field(..., ge=1)


@router.post("/{game_id}/void", response_model=schemas.Game)
def void_game(
    game_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Mark a game as annulled.

    Voids are reversible in practice by re-setting ``is_voided=False``
    via the regular ``PUT /games/{id}`` endpoint. The score is left
    untouched so the audit trail is preserved; standings computations
    treat ``is_voided=True`` as a "skip this game" signal.

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    :return: The updated game.
    """
    game = _get_game_or_404(db, game_id)
    try:
        game.is_voided = True
        game.is_live = False
        game.clock_running = False
        game.clock_started_at = None
        db.commit()
        db.refresh(game)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not void game: {str(exc)}",
        ) from exc
    return game


@router.post("/{game_id}/forfeit", response_model=schemas.Game)
def forfeit_game(
    game_id: int,
    body: ForfeitRequest,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    """Record a forfeit winner for a game.

    The ``winner_team_id`` MUST be one of the two teams participating.
    Scores are not overwritten — the standings engine reads this column
    to credit the winner with the win. If the game is already voided
    we 409 to avoid producing contradictory state.

    :param game_id: Game primary key.
    :param body: Forfeit payload declaring the winning team.
    :param db: SQLAlchemy session.
    :return: The updated game.
    """
    game = _get_game_or_404(db, game_id)
    if game.is_voided:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Game is voided — clear the void before recording a forfeit.",
        )
    if body.winner_team_id not in (game.home_team_id, game.away_team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"winner_team_id must be the home ({game.home_team_id}) or "
                f"away ({game.away_team_id}) team of this game."
            ),
        )
    try:
        game.forfeit_winner_team_id = body.winner_team_id
        game.is_completed = True
        game.is_live = False
        game.clock_running = False
        game.clock_started_at = None
        game.end_time = datetime.now(timezone.utc)
        db.commit()
        db.refresh(game)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not record forfeit: {str(exc)}",
        ) from exc
    return game


# ---------------------------------------------------------------------------
# Undo last event
# ---------------------------------------------------------------------------
@router.post("/{game_id}/events/undo", response_model=schemas.Game)
def undo_last_event(
    game_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(require_scorekeeper),
):
    """Undo the most recent event recorded against a game.

    Rolls back the effect of the last ``game_events`` row on the game score
    and on ``player_tournament_stats``. Used by the live scoring console
    when a scorekeeper mis-taps a button. Idempotent in the sense that it
    refuses to operate on a completed game; otherwise a second call after
    a successful first will simply delete the new last event.

    Behavior matrix:
      - ``GOAL``:    decrement player goals, game.home_score / away_score.
      - ``ASSIST``:  decrement player assists.
      - ``DEFENSE``: decrement player defenses.
      - ``TIMEOUT``: just delete (no stat counter).
      - ``SUBSTITUTION`` with ``points == 99`` (timeout-end marker):
                     just delete.
      - ``HALF``:    reject (cannot rewind a half without losing all
                     subsequent stats; human should correct via /end).

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    :return: The updated game after rollback.
    """
    game = _get_game_or_404(db, game_id)
    _ensure_not_completed(game)

    last_event = (
        db.query(models.GameEvent)
        .filter(models.GameEvent.game_id == game.id)
        .order_by(models.GameEvent.id.desc())
        .first()
    )
    if last_event is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No events to undo for this game.",
        )

    if last_event.event_type == models.GameEventTypeEnum.HALF:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot undo a HALF event. If you advanced prematurely, "
                "delete the subsequent events manually or contact an admin."
            ),
        )

    try:
        if last_event.event_type == models.GameEventTypeEnum.GOAL:
            stats = _get_or_create_player_stats(
                db, last_event.player_id, game.tournament_id
            )
            stats.goals = max(stats.goals - 1, 0)
            # Subtract the points the goal contributed from the team total.
            player = _get_player_or_404(db, last_event.player_id)
            delta = int(last_event.points or 1)
            if player.team_id == game.home_team_id:
                game.home_score = max(game.home_score - delta, 0)
            elif player.team_id == game.away_team_id:
                game.away_score = max(game.away_score - delta, 0)
        elif last_event.event_type == models.GameEventTypeEnum.ASSIST:
            stats = _get_or_create_player_stats(
                db, last_event.player_id, game.tournament_id
            )
            stats.assists = max(stats.assists - 1, 0)
        elif last_event.event_type == models.GameEventTypeEnum.DEFENSE:
            stats = _get_or_create_player_stats(
                db, last_event.player_id, game.tournament_id
            )
            stats.defenses = max(stats.defenses - 1, 0)
        # TIMEOUT and SUBSTITUTION (timeout-end marker) are pure markers —
        # deleting them has no stat side-effects.

        db.delete(last_event)
        db.commit()
        db.refresh(game)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not undo last event: {str(exc)}",
        ) from exc

    return game


# ---------------------------------------------------------------------------
# Convenience: game events list
# ---------------------------------------------------------------------------
@router.get("/{game_id}/events", response_model=List[schemas.GameEvent])
def list_game_events(game_id: int, db: Session = Depends(get_db), _: str = Depends(require_public)):
    """List all events recorded for a game.

    :param game_id: Game primary key.
    :param db: SQLAlchemy session.
    :return: List of game events ordered by creation time.
    """
    _get_game_or_404(db, game_id)
    try:
        events = (
            db.query(models.GameEvent)
            .filter(models.GameEvent.game_id == game_id)
            .order_by(models.GameEvent.created_at.asc(), models.GameEvent.id.asc())
            .all()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not list game events: {str(exc)}",
        ) from exc
    return events
