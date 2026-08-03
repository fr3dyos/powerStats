"""
Module: elimination_bracket.py
Purpose: Generate single and double elimination tournament brackets
Author: <placeholder>
Created: 2026-08-02
Version: 1.0.0
License: MIT

References:
    - Power-of-two seeding and bye allocation:
      https://stackoverflow.com/questions/10456335 [web:22]
    - Seeding methodology (byes proportional to next power of two):
      standard knockout tournament fixture rules [web:26]
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Match:
    """Represents a single bracket match."""
    round_no: int
    slot_a: Optional[str]
    slot_b: Optional[str]
    winner: Optional[str] = None


def next_power_of_two(n: int) -> int:
    """Return the smallest power of two >= n."""
    return 1 if n <= 1 else 2 ** math.ceil(math.log2(n))


def standard_seed_order(size: int) -> List[int]:
    """
    Compute standard bracket seed order (1-indexed) for a bracket of
    given power-of-two size, so seed 1 and seed 2 meet only in the final.
    """
    if size == 1:
        return [1]
    prev = standard_seed_order(size // 2)
    result = []
    for s in prev:
        result.append(s)
        result.append(size + 1 - s)
    return result


def generate_single_elimination(seeds: List[str]) -> List[List[Match]]:
    """
    Generate a single elimination bracket with byes for top seeds.

    Args:
        seeds: Ordered list of competitors, seed 1 first.

    Returns:
        List of rounds; round 0 is the first round (with byes as slot=None).
    """
    n = len(seeds)
    bracket_size = next_power_of_two(n)
    order = standard_seed_order(bracket_size)

    padded = seeds + [None] * (bracket_size - n)
    slots = [padded[i - 1] if i <= n else None for i in order]

    round_matches = [
        Match(round_no=0, slot_a=slots[i], slot_b=slots[i + 1])
        for i in range(0, bracket_size, 2)
    ]

    rounds = [round_matches]
    remaining = bracket_size // 2
    rnd = 1
    while remaining > 1:
        rounds.append([Match(round_no=rnd, slot_a=None, slot_b=None)
                        for _ in range(remaining // 2)])
        remaining //= 2
        rnd += 1

    return rounds


def generate_double_elimination_losers_size(n_winners_round1: int) -> List[int]:
    """
    Compute the number of matches per round in the losers bracket
    for a double-elimination tournament, given the winners bracket size.

    Note: Standard double-elim losers bracket alternates between rounds
    that absorb new losers and rounds that consolidate existing survivors.
    """
    sizes = []
    n = n_winners_round1 // 2
    while n >= 1:
        sizes.append(n)
        if n == 1:
            break
        n = n // 2 if len(sizes) % 2 == 0 else n
    return sizes


if __name__ == "__main__":
    seeds = [f"Seed {i}" for i in range(1, 12)]  # 11 competitors -> 16 bracket, 5 byes
    bracket = generate_single_elimination(seeds)
    for i, rnd in enumerate(bracket):
        print(f"Round {i + 1}: {rnd}")