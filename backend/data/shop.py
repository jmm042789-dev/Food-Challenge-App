"""
Fire Feast Shop Database

All shop items are defined here.

The Shop screen, Daily Rewards, Events,
and future Battle Pass can all pull
items from this file.
"""

SHOP_ITEMS = [

    # =====================================
    # POWER UPS
    # =====================================

    {
        "id": "tap_boost",
        "name": "Tap Boost",
        "type": "gear",
        "category": "Power Up",

        "icon": "⚡",

        "price": 50,

        "rarity": "Common",

        "perk": "+1 Tap Power",

        "description": "Every tap counts as two bites."
    },

    {
        "id": "combo_boost",
        "name": "Combo Boost",
        "type": "gear",
        "category": "Power Up",

        "icon": "🔥",

        "price": 75,

        "rarity": "Rare",

        "perk": "+25% Combo Duration",

        "description": "Keep combos alive longer."
    },

    {
        "id": "score_multiplier",
        "name": "Score Multiplier",
        "type": "gear",
        "category": "Power Up",

        "icon": "💥",

        "price": 100,

        "rarity": "Epic",

        "perk": "1.5x Score",

        "description": "Earn bonus points every contest."
    },

    # =====================================
    # BOOSTERS
    # =====================================

    {
        "id": "antacid_pack",

        "name": "Antacid Pack",

        "type": "consumable",

        "category": "Booster",

        "icon": "🧴",

        "price": 35,

        "rarity": "Common",

        "perk": "+5 Antacid",

        "description": "Recover from heartburn faster."
    },

    {
        "id": "closed_beta_welcome_pack",

        "name": "🎁 Closed Beta Welcome Pack",

        "type": "welcome_pack",

        "category": "Closed Beta",

        "icon": "🎁",

        "price": 0,

        "coin_reward": 50000,

        "xp_reward": 5000,

        "rarity": "One Time",

        "perk": "+50,000 Coins · +5,000 XP",

        "description": "A one-time reward so beta testers can fully explore Fire Feast before launch."
    },

    # =====================================
    # COSMETICS
    # =====================================

    {
        "id": "gold_apron",

        "name": "Golden Apron",

        "type": "cosmetic",

        "category": "Cosmetic",

        "icon": "🥇",

        "price": 500,

        "rarity": "Legendary",

        "description": "Show everyone you're a champion."
    },

]

# ======================================================
# Helpers
# ======================================================

def get_shop_item(item_id: str):
    """
    Returns one shop item.
    """

    for item in SHOP_ITEMS:

        if item["id"] == item_id:
            return item

    return None


def shop_by_category(category: str):
    """
    Returns all items in one category.
    """

    return [

        item

        for item in SHOP_ITEMS

        if item["category"].lower() == category.lower()

    ]


def shop_categories():
    """
    Returns every shop category.
    """

    return sorted(

        {

            item["category"]

            for item in SHOP_ITEMS

        }

    )


def featured_shop_items(count: int = 3):
    """
    Returns the featured shop items.

    Later these can rotate daily.
    """

    return SHOP_ITEMS[:count]
