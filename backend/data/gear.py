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

        "name": "Tap Boost",

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
        "id": "combo_boost",

        "name": "Combo Boost",

        "slot": "Hands",

        "rarity": "Rare",

        "icon": "🔥",

        "price": 75,

        "tap_bonus": 0,

        "combo_bonus": 25,

        "heartburn_resistance": 0,

        "description": "Increases the combo window from 700 ms to 875 ms."
    },

    {
        "id": "score_multiplier",

        "name": "Score Multiplier",

        "slot": "Hands",

        "rarity": "Epic",

        "icon": "💥",

        "price": 100,

        "tap_bonus": 0,

        "combo_bonus": 0,

        "heartburn_resistance": 0,

        "description": "Earn 1.5x score with 15% additional tap heat."
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

# The production-candidate collection replaces the small prototype list above
# while its legacy IDs remain valid through match-validation compatibility.
def _item(item_id, name, slot, rarity, price, level, color, effect, description, set_id=None):
    return {"id": item_id, "name": name, "type": "gear", "category": "Gear", "slot": slot, "rarity": rarity, "price": price, "unlock_level": level, "visual": {"color": color, "shape": slot.lower()}, "effect": effect, "description": description, "effect_description": description, "set_id": set_id}


GEAR = [
    _item("ember_cap", "Ember Service Cap", "Hat", "Common", 120, 1, "#C84A24", {"heat_generation_multiplier": .98}, "Reduces heat gained by 2%."),
    _item("steady_band", "Steady Streak Band", "Hat", "Common", 140, 1, "#C99845", {"combo_window_ms": 714}, "Adds 14 ms to the combo window."),
    _item("cool_cloche", "Cool-Head Cloche", "Hat", "Rare", 280, 4, "#4B9BA5", {"heat_generation_multiplier": .97}, "Reduces heat gained by 3%."),
    _item("risk_crown", "Flashpoint Crown", "Hat", "Epic", 520, 8, "#B43B31", {"score_multiplier": 1.04, "heat_generation_multiplier": 1.03}, "Scores 4% more but generates 3% more heat."),
    _item("precision_toque", "Precision Toque", "Hat", "Rare", 340, 5, "#E8D9B7", {"tap_power": 1.025}, "Improves scoring progress per accepted action by 2.5%."),
    _item("marathon_hat", "Marathon Chef Hat", "Hat", "Epic", 620, 10, "#7252A3", {"combo_window_ms": 742, "heat_generation_multiplier": .99}, "Adds 42 ms to combos and reduces heat by 1%."),
    _item("shannon_hat", "Chef Shannon Hat", "Hat", "Rare", 360, 1, "#2E7D6E", {"heat_generation_multiplier": .98}, "Reduces heat gained by 2%.", "chef_shannon"),
    _item("lynette_hat", "Chef Lynette Hat", "Hat", "Rare", 360, 1, "#8A4FA3", {"combo_window_ms": 728}, "Adds 28 ms to the combo window.", "chef_lynette"),
    _item("brittany_hat", "Chef Brittany Hat", "Hat", "Rare", 360, 1, "#2F77A8", {"heat_generation_multiplier": .99, "combo_window_ms": 714}, "Reduces heat by 1% and adds 14 ms to combos.", "chef_brittany"),

    _item("starter_apron", "Emberline Apron", "Apron", "Common", 110, 1, "#9C3D27", {"score_multiplier": 1.01}, "Scores 1% more."),
    _item("cooling_apron", "Cooling-Rack Apron", "Apron", "Rare", 300, 4, "#3F8E95", {"heat_generation_multiplier": .97}, "Reduces heat gained by 3%."),
    _item("combo_apron", "Streakkeeper Apron", "Apron", "Rare", 320, 5, "#D39C35", {"combo_window_ms": 735}, "Adds 35 ms to the combo window."),
    _item("blazing_apron", "Blazing Risk Apron", "Apron", "Epic", 540, 8, "#D04425", {"score_multiplier": 1.045, "heat_generation_multiplier": 1.035}, "Scores 4.5% more but generates 3.5% more heat."),
    _item("measured_apron", "Measured Service Apron", "Apron", "Common", 170, 2, "#70655A", {"tap_power": 1.02}, "Improves progress per accepted action by 2%."),
    _item("gold_standard_apron", "Gold Standard Apron", "Apron", "Legendary", 900, 14, "#D6A52F", {"score_multiplier": 1.025, "heat_generation_multiplier": .98}, "Scores 2.5% more and reduces heat by 2%."),
    _item("shannon_apron", "Chef Shannon Apron", "Apron", "Rare", 390, 1, "#44A18C", {"heat_generation_multiplier": .975}, "Reduces heat gained by 2.5%.", "chef_shannon"),
    _item("lynette_apron", "Chef Lynette Apron", "Apron", "Rare", 390, 1, "#A968B8", {"combo_window_ms": 735}, "Adds 35 ms to the combo window.", "chef_lynette"),
    _item("brittany_apron", "Chef Brittany Apron", "Apron", "Rare", 390, 1, "#4C91C2", {"heat_generation_multiplier": .98}, "Reduces heat gained by 2%.", "chef_brittany"),

    _item("service_blacks", "Service Blacks", "Outfit", "Common", 150, 1, "#343238", {"tap_power": 1.015}, "Improves progress per accepted action by 1.5%."),
    _item("coolline_outfit", "Coolline Uniform", "Outfit", "Rare", 330, 5, "#326D78", {"heat_generation_multiplier": .97}, "Reduces heat gained by 3%."),
    _item("combo_coat", "Combo Service Coat", "Outfit", "Rare", 350, 6, "#8C6932", {"combo_window_ms": 735}, "Adds 35 ms to the combo window."),
    _item("high_heat_outfit", "High-Heat Jacket", "Outfit", "Epic", 580, 9, "#A93428", {"score_multiplier": 1.05, "heat_generation_multiplier": 1.04}, "Scores 5% more but generates 4% more heat."),
    _item("all_rounder", "Arena All-Rounder", "Outfit", "Epic", 650, 11, "#5C596A", {"tap_power": 1.02, "combo_window_ms": 714, "heat_generation_multiplier": .99}, "Adds 2% progress, 14 ms combo time, and 1% heat control."),
    _item("champion_whites", "Champion Whites", "Outfit", "Legendary", 980, 15, "#ECE2C8", {"score_multiplier": 1.03, "combo_window_ms": 721}, "Scores 3% more and adds 21 ms to combos."),
    _item("shannon_outfit", "Chef Shannon Outfit", "Outfit", "Rare", 450, 1, "#22594F", {"heat_generation_multiplier": .975}, "Reduces heat gained by 2.5%.", "chef_shannon"),
    _item("lynette_outfit", "Chef Lynette Outfit", "Outfit", "Rare", 450, 1, "#623873", {"score_multiplier": 1.02, "combo_window_ms": 721}, "Scores 2% more and adds 21 ms to combos.", "chef_lynette"),
    _item("brittany_outfit", "Chef Brittany Outfit", "Outfit", "Rare", 450, 1, "#234F75", {"tap_power": 1.02, "heat_generation_multiplier": .99}, "Adds 2% progress and reduces heat by 1%.", "chef_brittany"),
]

GEAR_SETS = {
    "chef_shannon": {"id": "chef_shannon", "name": "Chef Shannon's Preset", "note": "Fire Feast Beta Tester Collection", "pieces": ["shannon_hat", "shannon_apron", "shannon_outfit"], "bundle_discount": .10, "bonus": {"heat_generation_multiplier": .98}, "bonus_description": "Full set: an additional 2% heat-gain reduction."},
    "chef_lynette": {"id": "chef_lynette", "name": "Chef Lynette's Preset", "note": "Fire Feast Beta Tester Collection", "pieces": ["lynette_hat", "lynette_apron", "lynette_outfit"], "bundle_discount": .10, "bonus": {"combo_window_ms": 28}, "bonus_description": "Full set: an additional 28 ms combo window."},
    "chef_brittany": {"id": "chef_brittany", "name": "Chef Brittany's Preset", "note": "Fire Feast Beta Tester Collection", "pieces": ["brittany_hat", "brittany_apron", "brittany_outfit"], "bundle_discount": .10, "bonus": {"tap_power": 1.015, "heat_generation_multiplier": .99}, "bonus_description": "Full set: 1.5% progress efficiency and 1% heat control."},
}

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
