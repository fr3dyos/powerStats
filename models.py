from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tournament = relationship("Tournament", back_populates="games")
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