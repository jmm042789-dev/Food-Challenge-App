"""
Fire Feast Contest Service

Business logic for contests.

The API should call these functions instead of
working directly with contest data.
"""

from data.contests import (
    CONTESTS,
    get_contest,
    featured_contest,
    contest_categories,
    contests_by_category,
)


# ==========================================================
# GETTERS
# ==========================================================

def all_contests():
    """
    Return every contest.
    """
    return CONTESTS


def contest(contest_id: str):
    """
    Return one contest.
    """
    return get_contest(contest_id)


def featured():
    """
    Return today's featured contest.
    """
    return featured_contest()


def categories():
    """
    Return all contest categories.
    """
    return contest_categories()


def by_category(category: str):
    """
    Return contests in one category.
    """
    return contests_by_category(category)


# ==========================================================
# FILTERS
# ==========================================================

def by_difficulty(difficulty: str):

    return [
        contest
        for contest in CONTESTS
        if contest["difficulty"].lower() == difficulty.lower()
    ]


def by_entry_fee(max_fee: int):

    return [
        contest
        for contest in CONTESTS
        if contest["entry_fee"] <= max_fee
    ]


def by_prize(min_prize: int):

    return [
        contest
        for contest in CONTESTS
        if contest["prize_pool"] >= min_prize
    ]


# ==========================================================
# HOME SCREEN
# ==========================================================

def home_featured():

    contest = featured()

    return {
        "id": contest["id"],
        "name": contest["name"],
        "artwork": contest["artwork"],
        "category": contest["category"],
        "difficulty": contest["difficulty"],
        "difficulty_color": contest["difficulty_color"],
        "entry_fee": contest["entry_fee"],
        "prize_pool": contest["prize_pool"],
        "location": contest["location"],
        "duration_sec": contest["duration_sec"],
        "color": contest["color"],
    }