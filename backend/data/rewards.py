"""
Fire Feast Rewards Database

All rewards for the game are stored here.

This includes:

- Daily Login Rewards
- Contest Rewards
- League Rewards
- Achievement Rewards
- Future Seasonal Rewards
"""

# ==========================================================
# DAILY LOGIN REWARDS
# ==========================================================

DAILY_REWARDS = [

    {
        "day": 1,
        "coins": 100,
        "xp": 25,
        "antacid": 1,
    },

    {
        "day": 2,
        "coins": 150,
        "xp": 35,
        "antacid": 1,
    },

    {
        "day": 3,
        "coins": 250,
        "xp": 50,
        "antacid": 2,
    },

    {
        "day": 4,
        "coins": 400,
        "xp": 75,
        "antacid": 2,
    },

    {
        "day": 5,
        "coins": 600,
        "xp": 100,
        "antacid": 3,
    },

    {
        "day": 6,
        "coins": 850,
        "xp": 150,
        "antacid": 4,
    },

    {
        "day": 7,
        "coins": 1500,
        "xp": 300,
        "antacid": 5,
    },

]

# ==========================================================
# CONTEST REWARDS
# ==========================================================

CONTEST_REWARDS = {

    "Easy": {
        "coins": 100,
        "xp": 40,
    },

    "Medium": {
        "coins": 200,
        "xp": 80,
    },

    "Hard": {
        "coins": 350,
        "xp": 140,
    },

    "Legendary": {
        "coins": 600,
        "xp": 250,
    },

}

# ==========================================================
# LEAGUE REWARDS
# ==========================================================

LEAGUE_REWARDS = {

    "Bronze": 250,

    "Silver": 500,

    "Gold": 1000,

    "Diamond": 2500,

    "Master": 5000,

}

# ==========================================================
# ACHIEVEMENT REWARDS
# ==========================================================

ACHIEVEMENTS = [

    {
        "id": "first_win",
        "title": "First Victory",
        "coins": 250,
        "xp": 100,
    },

    {
        "id": "combo_25",
        "title": "25 Combo",
        "coins": 300,
        "xp": 150,
    },

    {
        "id": "combo_50",
        "title": "50 Combo",
        "coins": 500,
        "xp": 250,
    },

    {
        "id": "eat_1000",
        "title": "1000 Bites",
        "coins": 750,
        "xp": 350,
    },

    {
        "id": "legend",
        "title": "Fire Feast Legend",
        "coins": 5000,
        "xp": 1500,
    },

]

# ==========================================================
# HELPERS
# ==========================================================

def get_daily_reward(day: int):
    """
    Return reward for a specific login day.
    """

    if day < 1:
        day = 1

    if day > len(DAILY_REWARDS):
        day = len(DAILY_REWARDS)

    return DAILY_REWARDS[day - 1]


def contest_reward(difficulty: str):
    """
    Return contest reward based on difficulty.
    """

    return CONTEST_REWARDS.get(
        difficulty,
        CONTEST_REWARDS["Easy"]
    )


def league_reward(rank: str):
    """
    Return coins awarded for league placement.
    """

    return LEAGUE_REWARDS.get(rank, 0)


def achievement(achievement_id: str):
    """
    Return an achievement reward.
    """

    for reward in ACHIEVEMENTS:

        if reward["id"] == achievement_id:
            return reward

    return None