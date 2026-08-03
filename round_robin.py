"""
Module: round_robin.py
Purpose: Generate a round-robin schedule using the circle method
Author: <placeholder>
Created: 2026-08-02
Version: 1.0.0
License: MIT

Reference:
    Circle method for round-robin tournament scheduling.
    See: https://en.wikipedia.org/wiki/Round-robin_tournament
"""

from typing import List, Tuple, Union

Team = Union[str, int]
Match = Tuple[Team, Team]


def generate_round_robin(teams: List[Team]) -> List[List[Match]]:
    """
    Generate a full round-robin schedule using the circle method.

    Args:
        teams: List of team identifiers (names or IDs). Length may be odd or even.

    Returns:
        List of rounds, each round is a list of (team_a, team_b) match tuples.
        A team paired with None indicates a bye.

    Side effects:
        None (pure function).
    """
    team_list: List[Union[Team, None]] = list(teams)
    if len(team_list) % 2 == 1:
        team_list.append(None)  # bye placeholder

    n = len(team_list)
    num_rounds = n - 1
    half = n // 2
    schedule: List[List[Match]] = []

    fixed = team_list[0]
    rotating = team_list[1:]

    for rnd in range(num_rounds):
        current = [fixed] + rotating
        round_matches: List[Match] = []
        for i in range(half):
            a, b = current[i], current[n - 1 - i]
            if a is not None and b is not None:
                round_matches.append((a, b) if rnd % 2 == 0 else (b, a))
        schedule.append(round_matches)
        rotating = [rotating[-1]] + rotating[:-1]  # rotate clockwise

    return schedule


if __name__ == "__main__":
    teams = ["Team A", "Team B", "Team C", "Team D", "Team E"]
    for i, rnd in enumerate(generate_round_robin(teams), start=1):
        print(f"Round {i}: {rnd}")