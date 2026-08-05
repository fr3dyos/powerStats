from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text, Enum,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

# Enums for game rules and event types
class GameRuleEnum(str, enum.Enum):
    TIME_LIMIT = "time_limit"
    SCORE_LIMIT = "score_limit"

class GameEventTypeEnum(str, enum.Enum):
    GOAL = "goal"
    ASSIST = "assist"
    DEFENSE = "defense"
    TIMEOUT = "timeout"
    HALF = "half"
    SUBSTITUTION = "substitution"

# Enums for tournament phases / standings
class PhaseTypeEnum(str, enum.Enum):
    ROUND_ROBIN = "round_robin"
    BRACKET = "bracket"

class PhaseStatusEnum(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class TiebreakerEnum(str, enum.Enum):
    POINTS = "points"
    WINS = "wins"
    GOAL_DIFFERENCE = "goal_difference"
    GOALS_FOR = "goals_for"
    GOALS_AGAINST = "goals_against"
    DIRECT_MATCHUP = "direct_matchup"
    SPIRIT_SCORE = "spirit_score"

# Tournament model
class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    teams = relationship("Team", back_populates="tournament")
    games = relationship("Game", back_populates="tournament")
    player_stats = relationship("PlayerTournamentStats", back_populates="tournament")
    phases = relationship(
        "Phase",
        back_populates="tournament",
        cascade="all, delete-orphan",
        order_by="Phase.phase_order",
    )

# Phase model
class Phase(Base):
    __tablename__ = "phases"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    name = Column(String(255), nullable=False)
    phase_order = Column(Integer, nullable=False, default=1)
    phase_type = Column(Enum(PhaseTypeEnum), nullable=False)
    status = Column(Enum(PhaseStatusEnum), nullable=False, default=PhaseStatusEnum.PENDING)
    # status_mode: 'auto' derives from completed games; 'manual' tracks a
    # explicit admin-set status.
    status_mode = Column(String(16), nullable=False, default="auto")
    # Config JSON stores, for example:
    #   {
    #     "points_win": 3, "points_draw": 1, "points_loss": 0,
    #     "group_count": 2, "advancing_teams": 2,
    #     "tiebreakers": ["points", "goal_difference", "goals_for",
    #                     "goals_against", "direct_matchup", "spirit_score"],
    #     "include_placement_matches": true
    #   }
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tournament = relationship("Tournament", back_populates="phases")
    groups = relationship(
        "Group",
        back_populates="phase",
        cascade="all, delete-orphan",
        order_by="Group.group_order",
    )
    games = relationship("Game", back_populates="phase")

# Group model
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=False)
    name = Column(String(255), nullable=False)
    group_order = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    phase = relationship("Phase", back_populates="groups")
    team_links = relationship(
        "GroupTeam",
        back_populates="group",
        cascade="all, delete-orphan",
    )

# GroupTeam join model
class GroupTeam(Base):
    __tablename__ = "group_teams"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    seed = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    group = relationship("Group", back_populates="team_links")
    team = relationship("Team")

# Team model
class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    logo_url = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tournament = relationship("Tournament", back_populates="teams")
    players = relationship("Player", back_populates="team")
    home_games = relationship("Game", foreign_keys="Game.home_team_id", back_populates="home_team")
    away_games = relationship("Game", foreign_keys="Game.away_team_id", back_populates="away_team")

# Player model
class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    jersey_number = Column(Integer)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    team = relationship("Team", back_populates="players")
    game_events = relationship("GameEvent", back_populates="player")
    tournament_stats = relationship("PlayerTournamentStats", back_populates="player")

# Game model
class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    home_score = Column(Integer, default=0)
    away_score = Column(Integer, default=0)
    game_rule = Column(Enum(GameRuleEnum), nullable=False)
    time_limit = Column(Integer)  # in minutes
    score_limit = Column(Integer)  # points to win
    field_number = Column(Integer)
    is_completed = Column(Boolean, default=False)
    # Phase / group attribution (optional — games may also be created without
    # a phase for ad-hoc / friendly games).
    phase_id = Column(Integer, ForeignKey("phases.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    round_number = Column(Integer, nullable=True)  # round-robin round (1-based)
    # Bracket attribution.
    bracket_round = Column(Integer, nullable=True)  # 1=first round, 2=quarter, ...
    bracket_slot = Column(Integer, nullable=True)   # slot index within the round
    is_placement = Column(Boolean, default=False)   # True for 3rd/5th/7th place matches
    placement_position = Column(Integer, nullable=True)  # 1=final, 2=2nd, 3=3rd, ...
    # Spirit scores (0-10 per team per game, averaged later by the standings
    # engine; recorded by the admin after each game).
    spirit_home = Column(Float, nullable=True)
    spirit_away = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tournament = relationship("Tournament", back_populates="games")
    phase = relationship("Phase", back_populates="games")
    home_team = relationship("Team", foreign_keys=[home_team_id], back_populates="home_games")
    away_team = relationship("Team", foreign_keys=[away_team_id], back_populates="away_games")
    game_events = relationship("GameEvent", back_populates="game")

# GameEvent model
class GameEvent(Base):
    __tablename__ = "game_events"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    event_type = Column(Enum(GameEventTypeEnum), nullable=False)
    points = Column(Integer, default=0)  # for goals, assists, etc.
    time_elapsed = Column(Integer)  # in seconds from start of game
    period = Column(Integer)  # 1 for first half, 2 for second half
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    game = relationship("Game", back_populates="game_events")
    player = relationship("Player", back_populates="game_events")

# Spirit of the Game (SOTG) score model.
# Stores the five WFDF SOTG category scores (0-4 each) plus their total.
# Persisted per (tournament, team, team_against); the spirit import endpoint
# upserts on this unique combination.
class SpiritScore(Base):
    __tablename__ = "spirit_scores"

    id = Column(Integer, primary_key=True, index=True)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team_against_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    # WFDF SOTG categories.
    score_1 = Column(Integer, nullable=False, default=0)  # rules knowledge
    score_2 = Column(Integer, nullable=False, default=0)  # fouls & contact
    score_3 = Column(Integer, nullable=False, default=0)  # fair-mindedness
    score_4 = Column(Integer, nullable=False, default=0)  # positive attitude
    score_5 = Column(Integer, nullable=False, default=0)  # communication
    total = Column(Integer, nullable=False, default=0)  # sum of the five scores
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tournament = relationship("Tournament")
    team = relationship("Team", foreign_keys=[team_id])
    team_against = relationship("Team", foreign_keys=[team_against_id])


# PlayerTournamentStats model
class PlayerTournamentStats(Base):
    __tablename__ = "player_tournament_stats"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)
    games_played = Column(Integer, default=0)
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    defenses = Column(Integer, default=0)
    goals_conceded = Column(Integer, default=0)  # for defensive players
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    player = relationship("Player", back_populates="tournament_stats")
    tournament = relationship("Tournament", back_populates="player_stats")