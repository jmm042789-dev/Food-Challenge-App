"""
Fire Feast Gear Database

All wearable gear and equipment is defined here.

Each item can modify gameplay stats and will
eventually support upgrades and rarity effects.
"""

GEAR = [

    # ======================================================
    # TAP GEAR
    # ======================================================

    {
        "id": "tap_boost",

        "name": "Tap Boost Gloves",

        "slot": "Hands",

        "rarity": "Common",

        "icon": "⚡",

        "price": 50,

        "tap_bonus": 1,

        "combo_bonus": 0,

        "heartburn_resistance": 0,

        "description": "Adds +1 tap power."
    },

    {
        "id": "combo_gloves",

        "name": "Combo Gloves",

        "slot": "Hands",

        "rarity": "Rare",

        "icon": "🔥",

        "price": 125,

        "tap_bonus": 0,

        "combo_bonus": 20,

        "heartburn_resistance": 0,

        "description": "Combos last 20% longer."
    },

    {
        "id": "fire_apron",

        "name": "Fire Apron",

        "slot": "Body",

        "rarity": "Epic",

        "icon": "🧥",

        "price": 250,

        "tap_bonus": 2,

        "combo_bonus": 10,

        "heartburn_resistance": 5,

        "description": "Professional competitive eating apron."
    },

    {
        "id": "chef_hat",

        "name": "Champion Chef Hat",

        "slot": "Head",

        "rarity": "Legendary",

        "icon": "👨‍🍳",

        "price": 750,

        "tap_bonus": 3,

        "combo_bonus": 25,

        "heartburn_resistance": 10,

        "description": "Only the greatest eaters wear this."
    },

    {
        "id": "speed_shoes",

        "name": "Speed Shoes",

        "slot": "Feet",

        "rarity": "Rare",

        "icon": "👟",

        "price": 175,

        "tap_bonus": 1,

        "combo_bonus": 10,

        "heartburn_resistance": 0,

        "description": "Quick feet. Faster fingers."
    },

    {
        "id": "iron_stomach",

        "name": "Iron Stomach Belt",

        "slot": "Belt",

        "rarity": "Legendary",

        "icon": "🏆",

        "price": 1200,

        "tap_bonus": 0,

        "combo_bonus": 35,

        "heartburn_resistance": 25,

        "description": "Greatly reduces heartburn."
    },

]

# ======================================================
# Helpers
# ======================================================

def get_gear(gear_id: str):
    """
    Return a single gear item.
    """

    for gear in GEAR:

        if gear["id"] == gear_id:
            return gear

    return None


def gear_by_slot(slot: str):
    """
    Return all gear for one equipment slot.
    """

    return [

        gear

        for gear in GEAR

        if gear["slot"].lower() == slot.lower()

    ]


def gear_by_rarity(rarity: str):
    """
    Return all gear of one rarity.
    """

    return [

        gear

        for gear in GEAR

        if gear["rarity"].lower() == rarity.lower()

    ]


def gear_slots():
    """
    Return every equipment slot.
    """

    return sorted({

        gear["slot"]

        for gear in GEAR

    })


def featured_gear(count: int = 3):
    """
    Featured gear for the shop.
    """

    return GEAR[:count]