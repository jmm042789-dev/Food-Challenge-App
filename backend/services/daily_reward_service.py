"""Server-authoritative Daily Charcuterie Board rewards."""

from datetime import datetime, timedelta, timezone
import secrets

from services.player_service import find_player
from database import update_player_document


DAILY_SPIN_INTERVAL = timedelta(hours=24)
STREAK_GRACE = timedelta(hours=48)

# Weights are relative and intentionally centralized so beta balance can be
# adjusted without changing claim or persistence behavior.
DAILY_REWARD_TABLE = (
    {"id": "small_coins", "label": "Small Coins", "kind": "coins", "amount": 100, "weight": 25},
    {"id": "medium_coins", "label": "Medium Coins", "kind": "coins", "amount": 250, "weight": 17},
    {"id": "large_coins", "label": "Large Coins", "kind": "coins", "amount": 500, "weight": 8},
    {"id": "small_xp", "label": "Small XP", "kind": "xp", "amount": 75, "weight": 17},
    {"id": "medium_xp", "label": "Medium XP", "kind": "xp", "amount": 150, "weight": 11},
    {"id": "large_xp", "label": "Large XP", "kind": "xp", "amount": 300, "weight": 6},
    {"id": "large_xp_bonus", "label": "Large XP Bonus", "kind": "xp", "amount": 1000, "weight": 4},
    {"id": "one_antacid", "label": "1 Antacid", "kind": "antacid", "amount": 1, "weight": 5},
    {"id": "two_antacids", "label": "2 Antacids", "kind": "antacid", "amount": 2, "weight": 3},
    {"id": "antacid_bundle", "label": "Antacid Bundle", "kind": "antacid", "amount": 3, "weight": 2},
    {"id": "jackpot_coins", "label": "Jackpot Coins", "kind": "coins", "amount": 1500, "weight": 1},
    {"id": "jackpot_xp", "label": "Jackpot XP", "kind": "xp", "amount": 750, "weight": 1},
)
TOTAL_REWARD_WEIGHT = sum(reward["weight"] for reward in DAILY_REWARD_TABLE)


class DailySpinUnavailableError(Exception):
    def __init__(self, next_daily_spin: str):
        super().__init__("daily spin is not available")
        self.next_daily_spin = next_daily_spin


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_timestamp(value) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def public_reward_table() -> list[dict]:
    return [
        {key: reward[key] for key in ("id", "label", "kind", "amount")}
        for reward in DAILY_REWARD_TABLE
    ]


def choose_daily_reward(randbelow=secrets.randbelow) -> tuple[int, dict]:
    pick = randbelow(TOTAL_REWARD_WEIGHT)
    cumulative = 0
    for index, reward in enumerate(DAILY_REWARD_TABLE):
        cumulative += reward["weight"]
        if pick < cumulative:
            return index, dict(reward)
    raise RuntimeError("daily reward table is invalid")


def daily_spin_status(device_id: str, now: datetime | None = None) -> dict | None:
    player = find_player(device_id)
    if not player:
        return None
    current = (now or _utc_now()).astimezone(timezone.utc)
    next_spin = _parse_timestamp(player.get("next_daily_spin"))
    eligible = next_spin is None or current >= next_spin
    return {
        "eligible": eligible,
        "server_time": current.isoformat(),
        "next_daily_spin": current.isoformat() if eligible else next_spin.isoformat(),
        "daily_spin_streak": int(player.get("daily_spin_streak", 0)),
        "total_daily_spins": int(player.get("total_daily_spins", 0)),
        "free_spins_available": 1 if eligible else 0,
        "bonus_spins_available": int(player.get("bonus_spins", 0)),
        "reward_slices": public_reward_table(),
    }


def claim_daily_spin(
    device_id: str,
    now: datetime | None = None,
    randbelow=secrets.randbelow,
) -> dict | None:
    current = (now or _utc_now()).astimezone(timezone.utc)
    before = find_player(device_id)
    if not before:
        return None
    next_before = _parse_timestamp(before.get("next_daily_spin"))
    if next_before is not None and current < next_before:
        raise DailySpinUnavailableError(next_before.isoformat())

    reward_index, reward = choose_daily_reward(randbelow)
    next_spin = current + DAILY_SPIN_INTERVAL
    last_spin = _parse_timestamp(before.get("last_daily_spin"))
    streak = (
        int(before.get("daily_spin_streak", 0)) + 1
        if last_spin is not None and current - last_spin <= STREAK_GRACE
        else 1
    )
    increment = {reward["kind"]: reward["amount"], "total_daily_spins": 1}
    player = update_player_document(
        device_id,
        {
            "$inc": increment,
            "$set": {
                "last_daily_spin": current.isoformat(),
                "next_daily_spin": next_spin.isoformat(),
                "daily_spin_streak": streak,
            },
        },
        extra_filter={
            "$or": [
                {"next_daily_spin": {"$exists": False}},
                {"next_daily_spin": None},
                {"next_daily_spin": {"$lte": current.isoformat()}},
            ]
        },
    )
    if not player:
        latest = find_player(device_id)
        if not latest:
            return None
        next_latest = _parse_timestamp(latest.get("next_daily_spin")) or next_spin
        raise DailySpinUnavailableError(next_latest.isoformat())

    return {
        "reward": {key: reward[key] for key in ("id", "label", "kind", "amount")},
        "reward_index": reward_index,
        "player": player,
        "server_time": current.isoformat(),
        "next_daily_spin": next_spin.isoformat(),
        "daily_spin_streak": streak,
        "free_spins_available": 0,
        "bonus_spins_available": int(player.get("bonus_spins", 0)),
    }
