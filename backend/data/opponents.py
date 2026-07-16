"""
Fire Feast AI Opponent Database

Every AI eater in the game is defined here.

Future versions can load these from MongoDB or JSON.
"""

OPPONENTS = [

    {
        "id": "rookie_ron",

        "name": "Rookie Ron",

        "title": "Beginner",

        "emoji": "🙂",

        "difficulty": "Easy",

        "tap_speed": 2.0,

        "combo_skill": 0.25,

        "accuracy": 0.60,

        "aggression": 0.30,

        "favorite_food": "Hot Dogs",

        "reward_multiplier": 1.0,
    },

    {
        "id": "burger_bob",

        "name": "Burger Bob",

        "title": "Burger Master",

        "emoji": "🍔",

        "difficulty": "Medium",

        "tap_speed": 3.0,

        "combo_skill": 0.50,

        "accuracy": 0.75,

        "aggression": 0.55,

        "favorite_food": "Burgers",

        "reward_multiplier": 1.2,
    },

    {
        "id": "wing_walter",

        "name": "Wing Walter",

        "title": "Wing Crusher",

        "emoji": "🍗",

        "difficulty": "Hard",

        "tap_speed": 4.0,

        "combo_skill": 0.70,

        "accuracy": 0.82,

        "aggression": 0.75,

        "favorite_food": "Wings",

        "reward_multiplier": 1.5,
    },

    {
        "id": "pizza_pete",

        "name": "Pizza Pete",

        "title": "Slice King",

        "emoji": "🍕",

        "difficulty": "Hard",

        "tap_speed": 4.2,

        "combo_skill": 0.80,

        "accuracy": 0.85,

        "aggression": 0.80,

        "favorite_food": "Pizza",

        "reward_multiplier": 1.6,
    },

    {
        "id": "inferno_ivan",

        "name": "Inferno Ivan",

        "title": "World Champion",

        "emoji": "🔥",

        "difficulty": "Legendary",

        "tap_speed": 5.5,

        "combo_skill": 0.95,

        "accuracy": 0.95,

        "aggression": 1.00,

        "favorite_food": "Anything",

        "reward_multiplier": 2.5,
    },

]

# ==========================================================
# HELPERS
# ==========================================================

def get_opponent(opponent_id: str):
    """
    Return a single opponent.
    """

    for opponent in OPPONENTS:

        if opponent["id"] == opponent_id:
            return opponent

    return None


def opponents_by_difficulty(difficulty: str):
    """
    Return every opponent in a difficulty tier.
    """

    return [

        opponent

        for opponent in OPPONENTS

        if opponent["difficulty"].lower() == difficulty.lower()

    ]


def all_opponents():
    """
    Return every AI opponent.
    """

    return OPPONENTS


def random_opponent():
    """
    Return a random AI opponent.
    """

    import random

    return random.choice(OPPONENTS)