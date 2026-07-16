"""
Fire Feast Contest Database

All contests available in Fire Feast live here.

The API, Home screen, Arena, AI, and Tournament
systems all read from this file.
"""

CONTESTS = [

    {
        "id": "nathans-hotdogs",
        "name": "Coney Beach Dog Derby",
        "category": "Hot Dogs",
        "artwork": "bbq-platter",

        "location": "Coney Beach, NY",

        "food": "Hot Dogs",
        "food_emoji": "🌭",

        "entry_fee": 50,
        "prize_pool": 500,

        "difficulty": "Legendary",
        "difficulty_color": "#FF2A00",

        "duration_sec": 30,

        "image": "https://images.unsplash.com/photo-1542344807-21226ec94b39?crop=entropy&cs=srgb&fm=jpg&w=1080",

        "heartburn_per_bite": 2,

        "color": "#FF2A00",

        "bite_mechanic": "tap",
    },

    {
        "id": "wing-bowl",
        "name": "Liberty Bell Wing Brawl",
        "category": "Wings",
        "artwork": "wings",

        "location": "Liberty City, PA",

        "food": "Spicy Wings",
        "food_emoji": "🍗",

        "entry_fee": 30,
        "prize_pool": 300,

        "difficulty": "Hard",
        "difficulty_color": "#FF8300",

        "duration_sec": 25,

        "image": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?crop=entropy&cs=srgb&fm=jpg&w=1080",

        "heartburn_per_bite": 3,

        "color": "#E05A00",

        "bite_mechanic": "swipe",
    },

    {
        "id": "pizza-hut-stuffed",
        "name": "Stuffed Crust Slam",
        "category": "Pizza",
        "artwork": "pizza-pepperoni",

        "location": "Heartland, KS",

        "food": "Stuffed Crust Pizza",
        "food_emoji": "🍕",

        "entry_fee": 25,
        "prize_pool": 250,

        "difficulty": "Medium",
        "difficulty_color": "#FFC533",

        "duration_sec": 30,

        "image": "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?crop=entropy&cs=srgb&fm=jpg&w=1080",

        "heartburn_per_bite": 2,

        "color": "#FFB800",

        "bite_mechanic": "swipe",
    },

    {
        "id": "katz-pastrami",
        "name": "Lower East Pastrami Pile-Up",
        "category": "BBQ",
        "artwork": "bbq-platter",

        "location": "Lower East, NY",

        "food": "Pastrami Sandwich",
        "food_emoji": "🥪",

        "entry_fee": 20,
        "prize_pool": 200,

        "difficulty": "Medium",
        "difficulty_color": "#FFC533",

        "duration_sec": 30,

        "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?crop=entropy&cs=srgb&fm=jpg&w=1080",

        "heartburn_per_bite": 2,

        "color": "#7B3F00",

        "bite_mechanic": "tap",
    },

    {
        "id": "ben-jerry-icecream",
        "name": "Vermont Brain Freeze Bash",
        "category": "Dessert",
        "artwork": "dessert",

        "location": "Maple Hills, VT",

        "food": "Ice Cream",
        "food_emoji": "🍦",

        "entry_fee": 15,
        "prize_pool": 150,

        "difficulty": "Easy",
        "difficulty_color": "#47D147",

        "duration_sec": 25,

        "image": "https://images.unsplash.com/photo-1576506295286-5cda18df43e7?crop=entropy&cs=srgb&fm=jpg&w=1080",

        "heartburn_per_bite": 1,

        "color": "#FF6FA8",

        "bite_mechanic": "hold_release",
    },

    {
        "id": "in-n-out-burgers",
        "name": "West Coast Animal Burger Bash",
        "category": "Burger",
        "artwork": "burger-deluxe",

        "location": "Sunset City, CA",

        "food": "Burgers",
        "food_emoji": "🍔",

        "entry_fee": 35,
        "prize_pool": 350,

        "difficulty": "Hard",
        "difficulty_color": "#FF8300",

        "duration_sec": 30,

        "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=srgb&fm=jpg&w=1080",

        "heartburn_per_bite": 3,

        "color": "#D62828",

        "bite_mechanic": "rapid",
    },

]


def get_contest(contest_id: str):
    for contest in CONTESTS:
        if contest["id"] == contest_id:
            return contest

    return None


def featured_contest():
    """
    Returns the contest shown on the Home screen.

    Later we'll rotate this automatically each day.
    """
    return CONTESTS[0]


def contest_categories():
    return sorted(
        {
            contest["category"]
            for contest in CONTESTS
        }
    )


def contests_by_category(category: str):
    return [
        contest
        for contest in CONTESTS
        if contest["category"].lower() == category.lower()
    ]