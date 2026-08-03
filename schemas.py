from pydantic import BaseModel, Field
from typing import Optional, List
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

class GameCreate(GameBase):
    pass

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
TeamWithPlayers.update_forward_refs()
TeamWithGames.update_forward_refs()
PlayerWithEvents.update_forward_refs()
PlayerWithTournamentStats.update_forward_refs()
GameWithDetails.update_forward_refs()
GameEventWithDetails.update_forward_refs()