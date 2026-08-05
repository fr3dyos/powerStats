"""Seed a synthetic 8-team, two-phase tournament into the Supabase DB.

The skeleton is created in Phase 1 of this script and is one-shot:
a tournament, 8 teams, 10 players each, two groups, two phases.

The placeholder games for Phase 1 (24 of them: double round-robin across
two groups of four) are created in a separate idempotent pass. Re-running
this script is safe: the skeleton pass is skipped if the tournament
already exists; the games pass is skipped if 24 games already belong to
the tournament.

Usage:

    .\\.venv\\Scripts\\python.exe scripts\\seed_two_phase_tournament.py
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from database import SessionLocal  # noqa: E402
import models  # noqa: E402
from sqlalchemy import MetaData, Table  # noqa: E402

TOURNAMENT_NAME = "Demo Two-Phase Tournament"
TOURNAMENT_LOCATION = "Rio de Janeiro"
TOURNAMENT_START = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)
TOURNAMENT_END = datetime(2026, 9, 3, 18, 0, tzinfo=timezone.utc)
TOURNAMENT_DESCRIPTION = (
    "Synthetic 8-team, two-phase tournament for testing the standings → "
    "bracket pipeline. Phase 1 = double round-robin in two groups (A, B); "
    "Phase 2 = cross-bracket quarterfinals (1A v 4B, 2B v 3A, 2A v 3B, 4A v 1B)."
)

RANDOM_SEED = 42
NUM_TEAMS = 8
PLAYERS_PER_TEAM = 10
EXPECTED_PHASE1_GAMES = 24  # 12 per group (4 teams → 6 unique pairs × 2)

TEAM_ADJECTIVES = [
    "Thunder", "Cosmic", "Velvet", "Iron", "Crimson", "Mystic", "Neon",
    "Shadow", "Golden", "Silver", "Frozen", "Blazing", "Spectral", "Savage",
    "Lucky", "Wandering",
]
TEAM_NOUNS = [
    "Phoenix", "Wolves", "Comets", "Reavers", "Foxes", "Stallions",
    "Falcons", "Mantas", "Hawks", "Sharks", "Lynx", "Wizards",
    "Titans", "Ravens", "Cobras", "Drifters",
]
FIRST_NAMES = [
    "Alex", "Bia", "Caio", "Duda", "Eli", "Fe", "Gabi", "Hugo", "Isa",
    "João", "Karen", "Léo", "Mia", "Nina", "Otto", "Pâm", "Quinn",
    "Rafa", "Sofia", "Tico", "Urso", "Vivi", "Wes", "Xande", "Yuri",
    "Zeca", "Anita", "Bruno", "Clara", "Diego", "Estela", "Felipe",
    "Giulia", "Henrique", "Iara", "Joana", "Kai", "Lucas", "Marina",
    "Otávio", "Pedro", "Rita", "Samir", "Tatiana", "Ulisses",
    "Vinícius", "Yasmin",
]
LAST_NAMES = [
    "Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Ferreira",
    "Gomes", "Henriques", "Ishida", "Jardim", "Kowalski", "Lima",
    "Machado", "Nunes", "Oliveira", "Pereira", "Queiroz", "Ribeiro",
    "Silva", "Teixeira", "Uchoa", "Vasconcelos", "Watanabe", "Xavier",
    "Yamamoto", "Zimmermann",
]


def random_team_names(rng: random.Random, n: int) -> list[str]:
    names: set[str] = set()
    while len(names) < n:
        names.add(f"{rng.choice(TEAM_ADJECTIVES)} {rng.choice(TEAM_NOUNS)}")
    return list(names)


def random_player_name(rng: random.Random) -> tuple[str, str]:
    return rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)


def double_round_robin(team_ids: list[int]) -> list[tuple[int, int]]:
    """For each unordered pair (i, j), emit two fixtures (i v j and j v i)."""
    pairs: list[tuple[int, int]] = []
    for i in range(len(team_ids)):
        for j in range(i + 1, len(team_ids)):
            pairs.append((team_ids[i], team_ids[j]))
            pairs.append((team_ids[j], team_ids[i]))
    return pairs


def _players_legacy_table() -> Table:
    """Live players columns only (model declares `photo_url`, which is not
    in the live DB). Insert via Core so the ORM never references the missing
    column."""
    live_cols = {
        "id", "first_name", "last_name", "jersey_number",
        "team_id", "created_at", "updated_at",
    }
    return Table(
        "players",
        MetaData(),
        *[
            c.copy()
            for c in models.Player.__table__.columns
            if c.name in live_cols
        ],
    )


def _games_legacy_table() -> Table:
    """Live games columns only (model declares many newer columns that are
    not in the live DB)."""
    live_cols = {
        "id", "tournament_id", "home_team_id", "away_team_id",
        "start_time", "end_time", "home_score", "away_score",
        "game_rule", "time_limit", "score_limit", "field_number",
        "is_completed", "created_at", "updated_at",
    }
    return Table(
        "games",
        MetaData(),
        *[
            c.copy()
            for c in models.Game.__table__.columns
            if c.name in live_cols
        ],
    )


def seed_skeleton(session) -> models.Tournament | None:
    """Idempotent: create the tournament skeleton (teams, players, phases,
    groups, group_links, stats). Returns the Tournament row, or None if it
    already existed (in which case nothing was inserted).
    """
    existing = (
        session.query(models.Tournament)
        .filter(models.Tournament.name == TOURNAMENT_NAME)
        .first()
    )
    if existing is not None:
        print(f"Skeleton for '{TOURNAMENT_NAME}' already exists (id={existing.id}).")
        return None

    rng = random.Random(RANDOM_SEED)

    # Tournament
    tournament = models.Tournament(
        name=TOURNAMENT_NAME,
        start_date=TOURNAMENT_START,
        end_date=TOURNAMENT_END,
        location=TOURNAMENT_LOCATION,
        description=TOURNAMENT_DESCRIPTION,
    )
    session.add(tournament)
    session.flush()

    # Teams (deterministic order so group assignment is reproducible).
    teams = [
        models.Team(name=name, tournament_id=tournament.id)
        for name in random_team_names(rng, NUM_TEAMS)
    ]
    session.add_all(teams)
    session.flush()
    group_a_teams, group_b_teams = teams[:4], teams[4:]

    # Players — Core insert via sanitized Table.
    players_table = _players_legacy_table()
    players: list[tuple[int, int, int]] = []  # (player_id, team_id, jersey)
    for team in teams:
        for jersey in range(1, PLAYERS_PER_TEAM + 1):
            first, last = random_player_name(rng)
            result = session.execute(
                players_table.insert().values(
                    first_name=first,
                    last_name=last,
                    jersey_number=jersey,
                    team_id=team.id,
                )
            )
            players.append((result.inserted_primary_key[0], team.id, jersey))
    session.flush()

    # Phase 1 (round-robin, double, two groups).
    phase1 = models.Phase(
        tournament_id=tournament.id,
        name="Group Stage",
        phase_order=1,
        phase_type=models.PhaseTypeEnum.ROUND_ROBIN,
        status=models.PhaseStatusEnum.PENDING,
        status_mode="auto",
        config={
            "points_win": 3,
            "points_draw": 1,
            "points_loss": 0,
            "group_count": 2,
            "advancing_teams": 4,
            "tiebreakers": [
                "points", "wins", "goal_difference",
                "goals_for", "goals_against",
                "direct_matchup", "spirit_score",
            ],
            "rounds_per_matchup": 2,
            "include_placement_matches": False,
        },
    )
    session.add(phase1)
    session.flush()

    group_a = models.Group(phase_id=phase1.id, name="Group A", group_order=1)
    group_b = models.Group(phase_id=phase1.id, name="Group B", group_order=2)
    session.add_all([group_a, group_b])
    session.flush()

    group_links = []
    for seed_idx, team in enumerate(group_a_teams, start=1):
        link = models.GroupTeam(group_id=group_a.id, team_id=team.id, seed=seed_idx)
        session.add(link)
        group_links.append(link)
    for seed_idx, team in enumerate(group_b_teams, start=1):
        link = models.GroupTeam(group_id=group_b.id, team_id=team.id, seed=seed_idx)
        session.add(link)
        group_links.append(link)
    session.flush()

    # Phase 2 (bracket, no games yet — config encodes intended pairing rules).
    phase2 = models.Phase(
        tournament_id=tournament.id,
        name="Bracket",
        phase_order=2,
        phase_type=models.PhaseTypeEnum.BRACKET,
        status=models.PhaseStatusEnum.PENDING,
        status_mode="auto",
        config={
            "source_phase_id": phase1.id,
            "bracket_size": 8,
            "rounds": [{
                "round": 1,
                "name": "Quarterfinals",
                "matchups": [
                    {"slot": 1, "home": "1A", "away": "4B"},
                    {"slot": 2, "home": "2B", "away": "3A"},
                    {"slot": 3, "home": "2A", "away": "3B"},
                    {"slot": 4, "home": "4A", "away": "1B"},
                ],
            }],
            "include_placement_matches": False,
        },
    )
    session.add(phase2)
    session.flush()

    # Player stats placeholders (zeros; updated as games are played).
    for player_id, _team_id, _jersey in players:
        session.add(models.PlayerTournamentStats(
            player_id=player_id,
            tournament_id=tournament.id,
            games_played=0, goals=0, assists=0, defenses=0, goals_conceded=0,
        ))
    session.flush()

    print(
        f"Created skeleton for '{TOURNAMENT_NAME}' (id={tournament.id}):\n"
        f"  Teams: {len(teams)} -> {[t.name for t in teams]}\n"
        f"  Players: {len(players)} ({PLAYERS_PER_TEAM} per team)\n"
        f"  Phase 1: id={phase1.id} 'Group Stage'\n"
        f"    Group A: {[t.name for t in group_a_teams]}\n"
        f"    Group B: {[t.name for t in group_b_teams]}\n"
        f"  Phase 2: id={phase2.id} 'Bracket' "
        f"(quarterfinals: 1A v 4B, 2B v 3A, 2A v 3B, 4A v 1B)"
    )
    return tournament


def seed_games(session) -> int:
    """Idempotent: ensure 24 placeholder games exist for the tournament.
    Returns the number of games created (0 if already present)."""
    tournament = (
        session.query(models.Tournament)
        .filter(models.Tournament.name == TOURNAMENT_NAME)
        .first()
    )
    if tournament is None:
        raise RuntimeError(
            f"Tournament '{TOURNAMENT_NAME}' not found; run seed_skeleton first."
        )

    games_table = _games_legacy_table()
    existing_count = session.execute(
        games_table.select().where(games_table.c.tournament_id == tournament.id)
    ).rowcount
    if existing_count >= EXPECTED_PHASE1_GAMES:
        print(
            f"Phase 1 games already present ({existing_count}); "
            f"skipping fixture generation."
        )
        return 0

    # Look up the two groups and their teams.
    phase1 = (
        session.query(models.Phase)
        .filter(
            models.Phase.tournament_id == tournament.id,
            models.Phase.phase_order == 1,
        )
        .first()
    )
    groups = (
        session.query(models.Group)
        .filter(models.Group.phase_id == phase1.id)
        .order_by(models.Group.group_order.asc())
        .all()
    )
    teams_by_id = {
        t.id: t
        for t in session.query(models.Team).filter(
            models.Team.tournament_id == tournament.id
        ).all()
    }

    # Wipe any partial existing rows so a fresh set can be inserted cleanly.
    session.execute(
        games_table.delete().where(
            games_table.c.tournament_id == tournament.id
        )
    )

    created = 0
    fixtures_per_day = 4  # 4 fixtures per group per day × 2 groups = 8/day
    for group in groups:
        team_ids = [
            link.team_id
            for link in session.query(models.GroupTeam)
            .filter(models.GroupTeam.group_id == group.id)
            .order_by(models.GroupTeam.seed.asc())
            .all()
        ]
        for idx, (home_id, away_id) in enumerate(double_round_robin(team_ids)):
            day_offset, slot_in_day = divmod(idx, fixtures_per_day)
            start_time = TOURNAMENT_START + timedelta(
                days=day_offset, minutes=slot_in_day * 45
            )
            session.execute(games_table.insert().values(
                tournament_id=tournament.id,
                home_team_id=home_id,
                away_team_id=away_id,
                start_time=start_time,
                end_time=start_time + timedelta(minutes=30),
                home_score=0,
                away_score=0,
                game_rule=models.GameRuleEnum.TIME_LIMIT,
                time_limit=30,
                field_number=1,
                is_completed=False,
            ))
            created += 1
    session.flush()
    print(f"Created {created} Phase 1 placeholder games (double round-robin).")
    return created


def seed() -> None:
    session = SessionLocal()
    try:
        seed_skeleton(session)
        seed_games(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()