from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum as PyEnum

# Enums (mirroring SQLAlchemy enums)
class GameRuleEnum(str, PyEnum):
    TIME_LIMIT = "time_limit"
    SCORE_LIMIT = "score_limit"

class GameEventTypeEnum(str, PyEnum):
    GOAL = "goal"
    ASSIST = "assist"
    DEFENSE = "defense"
    TIMEOUT = "timeout"
    HALF = "half"
    SUBSTITUTION = "substitution"

class PhaseTypeEnum(str, PyEnum):
    ROUND_ROBIN = "round_robin"
    BRACKET = "bracket"

class PhaseStatusEnum(str, PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class TiebreakerEnum(str, PyEnum):
    POINTS = "points"
    WINS = "wins"
    GOAL_DIFFERENCE = "goal_difference"
    GOALS_FOR = "goals_for"
    GOALS_AGAINST = "goals_against"
    DIRECT_MATCHUP = "direct_matchup"
    SPIRIT_SCORE = "spirit_score"

# Tournament schemas
class TournamentBase(BaseModel):
    name: str = Field(..., max_length=255)
    start_date: datetime
    end_date: datetime
    location: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None

class TournamentCreate(TournamentBase):
    pass

class TournamentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None

class TournamentInDBBase(TournamentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Tournament(TournamentInDBBase):
    pass

class TournamentWithTeams(TournamentInDBBase):
    teams: List["Team"] = []

class TournamentWithGames(TournamentInDBBase):
    games: List["Game"] = []

class TournamentWithPhases(TournamentInDBBase):
    phases: List["Phase"] = []

# Phase schemas
class PhaseBase(BaseModel):
    name: str = Field(..., max_length=255)
    phase_order: int = Field(1, ge=1)
    phase_type: PhaseTypeEnum
    status: PhaseStatusEnum = PhaseStatusEnum.PENDING
    status_mode: str = Field("auto", regex="^(auto|manual)$")
    config: Dict[str, Any] = {}

class PhaseCreate(PhaseBase):
    pass

class PhaseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    phase_order: Optional[int] = Field(None, ge=1)
    status: Optional[PhaseStatusEnum] = None
    status_mode: Optional[str] = Field(None, regex="^(auto|manual)$")
    config: Optional[Dict[str, Any]] = None

class PhaseInDBBase(PhaseBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Phase(PhaseInDBBase):
    pass

class PhaseWithGroups(PhaseInDBBase):
    groups: List["Group"] = []

class PhaseWithGames(PhaseInDBBase):
    games: List["Game"] = []

# Group schemas
class GroupBase(BaseModel):
    phase_id: int
    name: str = Field(..., max_length=255)
    group_order: int = Field(1, ge=1)

class GroupCreate(GroupBase):
    team_ids: List[int] = []

class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    group_order: Optional[int] = Field(None, ge=1)

class GroupInDBBase(GroupBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Group(GroupInDBBase):
    pass

class GroupWithTeams(GroupInDBBase):
    team_links: List["GroupTeam"] = []

# GroupTeam schemas
class GroupTeamBase(BaseModel):
    group_id: int
    team_id: int
    seed: int = Field(0, ge=0)

class GroupTeamInDBBase(GroupTeamBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class GroupTeam(GroupTeamInDBBase):
    team: Optional["Team"] = None

# Standings / ranking schemas
class StandingsRow(BaseModel):
    position: int
    team_id: int
    team_name: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    points: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    spirit_total: float = 0.0
    spirit_games: int = 0
    spirit_average: float = 0.0
    direct_matchup: Optional[Dict[str, Any]] = None

class StandingsTable(BaseModel):
    phase_id: int
    phase_name: str = ""
    phase_type: str = ""
    groups: List[Dict[str, Any]] = []
    tiebreakers: List[str] = []
    generated_at: datetime

# Team schemas
class TeamBase(BaseModel):
    name: str = Field(..., max_length=255)
    tournament_id: int
    logo_url: Optional[str] = Field(None, max_length=255)

class TeamCreate(TeamBase):
    pass

class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    tournament_id: Optional[int] = None
    logo_url: Optional[str] = Field(None, max_length=255)

class TeamInDBBase(TeamBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Team(TeamInDBBase):
    pass

class TeamWithPlayers(TeamInDBBase):
    players: List["Player"] = []

class TeamWithGames(TeamInDBBase):
    home_games: List["Game"] = []
    away_games: List["Game"] = []

# Player schemas
class PlayerBase(BaseModel):
    first_name: str = Field(..., max_length=255)
    last_name: str = Field(..., max_length=255)
    jersey_number: Optional[int] = None
    team_id: int

class PlayerCreate(PlayerBase):
    pass

class PlayerUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)
    jersey_number: Optional[int] = None
    team_id: Optional[int] = None

class PlayerInDBBase(PlayerBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Player(PlayerInDBBase):
    pass

class PlayerWithEvents(PlayerInDBBase):
    game_events: List["GameEvent"] = []

class PlayerWithTournamentStats(PlayerInDBBase):
    tournament_stats: List["PlayerTournamentStats"] = []

# Game schemas
class GameBase(BaseModel):
    tournament_id: int
    home_team_id: int
    away_team_id: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    home_score: int = Field(0, ge=0)
    away_score: int = Field(0, ge=0)
    game_rule: GameRuleEnum
    time_limit: Optional[int] = Field(None, ge=0)  # in minutes
    score_limit: Optional[int] = Field(None, ge=0)  # points to win
    field_number: Optional[int] = None
    is_completed: bool = False
    # Live status + game clock (scorekeeper console).
    is_live: bool = False
    clock_running: bool = False
    clock_started_at: Optional[datetime] = None
    clock_elapsed: int = 0
    # Phase / group attribution
    phase_id: Optional[int] = None
    group_id: Optional[int] = None
    round_number: Optional[int] = Field(None, ge=1)
    # Bracket attribution
    bracket_round: Optional[int] = Field(None, ge=1)
    bracket_slot: Optional[int] = Field(None, ge=1)
    is_placement: bool = False
    placement_position: Optional[int] = Field(None, ge=1)
    # Spirit scores (0.0 - 10.0)
    spirit_home: Optional[float] = Field(None, ge=0.0, le=10.0)
    spirit_away: Optional[float] = Field(None, ge=0.0, le=10.0)

class GameCreate(GameBase):
    pass

class GameBatchCreate(BaseModel):
    """Bulk game scheduling payload (used by the CSV upload flow)."""
    tournament_id: int
    games: List[GameCreate]

class GameUpdate(BaseModel):
    tournament_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    home_score: Optional[int] = Field(None, ge=0)
    away_score: Optional[int] = Field(None, ge=0)
    game_rule: Optional[GameRuleEnum] = None
    time_limit: Optional[int] = Field(None, ge=0)
    score_limit: Optional[int] = Field(None, ge=0)
    field_number: Optional[int] = None
    is_completed: Optional[bool] = None
    is_live: Optional[bool] = None
    clock_running: Optional[bool] = None
    clock_started_at: Optional[datetime] = None
    clock_elapsed: Optional[int] = None
    phase_id: Optional[int] = None
    group_id: Optional[int] = None
    round_number: Optional[int] = Field(None, ge=1)
    bracket_round: Optional[int] = Field(None, ge=1)
    bracket_slot: Optional[int] = Field(None, ge=1)
    is_placement: Optional[bool] = None
    placement_position: Optional[int] = Field(None, ge=1)
    spirit_home: Optional[float] = Field(None, ge=0.0, le=10.0)
    spirit_away: Optional[float] = Field(None, ge=0.0, le=10.0)

class GameInDBBase(GameBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Game(GameInDBBase):
    pass

class GameWithDetails(GameInDBBase):
    home_team: "Team"
    away_team: "Team"
    tournament: "Tournament"
    game_events: List["GameEvent"] = []

# GameEvent schemas
class GameEventBase(BaseModel):
    game_id: int
    player_id: int
    event_type: GameEventTypeEnum
    points: int = Field(0, ge=0)
    time_elapsed: Optional[int] = Field(None, ge=0)  # in seconds from start of game
    period: Optional[int] = Field(None, ge=1, le=2)  # 1 for first half, 2 for second half

    @validator("time_elapsed", pre=True, always=True)
    def clamp_negative_elapsed(cls, v):
        # Legacy rows may store negative elapsed time; clamp instead of 500.
        if v is None:
            return None
        return max(v or 0, 0)

class GameEventCreate(GameEventBase):
    pass

class GameEventUpdate(BaseModel):
    game_id: Optional[int] = None
    player_id: Optional[int] = None
    event_type: Optional[GameEventTypeEnum] = None
    points: Optional[int] = Field(None, ge=0)
    time_elapsed: Optional[int] = Field(None, ge=0)
    period: Optional[int] = Field(None, ge=1, le=2)

class GameEventInDBBase(GameEventBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class GameEvent(GameEventInDBBase):
    pass

class GameEventWithDetails(GameEventInDBBase):
    game: "Game"
    player: "Player"

# PlayerTournamentStats schemas
class PlayerTournamentStatsBase(BaseModel):
    player_id: int
    tournament_id: int
    games_played: int = Field(0, ge=0)
    goals: int = Field(0, ge=0)
    assists: int = Field(0, ge=0)
    defenses: int = Field(0, ge=0)
    goals_conceded: int = Field(0, ge=0)  # for defensive players

class PlayerTournamentStatsCreate(PlayerTournamentStatsBase):
    pass

class PlayerTournamentStatsUpdate(BaseModel):
    player_id: Optional[int] = None
    tournament_id: Optional[int] = None
    games_played: Optional[int] = Field(None, ge=0)
    goals: Optional[int] = Field(None, ge=0)
    assists: Optional[int] = Field(None, ge=0)
    defenses: Optional[int] = Field(None, ge=0)
    goals_conceded: Optional[int] = Field(None, ge=0)

class PlayerTournamentStatsInDBBase(PlayerTournamentStatsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class PlayerTournamentStats(PlayerTournamentStatsInDBBase):
    pass

# Update forward references for nested models
TournamentWithTeams.update_forward_refs()
TournamentWithGames.update_forward_refs()
TournamentWithPhases.update_forward_refs()
TeamWithPlayers.update_forward_refs()
TeamWithGames.update_forward_refs()
PlayerWithEvents.update_forward_refs()
PlayerWithTournamentStats.update_forward_refs()
GameWithDetails.update_forward_refs()
GameEventWithDetails.update_forward_refs()
PhaseWithGroups.update_forward_refs()
PhaseWithGames.update_forward_refs()
GroupWithTeams.update_forward_refs()
