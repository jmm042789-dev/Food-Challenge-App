"""Atomic Fire Feast purchase and equipment operations."""

import logging
import os

from data.shop import get_shop_item
from data.gear import GEAR_SETS, get_gear
from database import update_player_document
from services.player_service import find_player, get_or_create_player


ANTACID_GRANTS = {"antacid_pack": 5}
LEGACY_GEAR_IDS = {"tap_boost", "combo_boost", "score_multiplier"}
logger = logging.getLogger(__name__)
COIN_DEBUG_LOGGING = os.environ.get("FIRE_FEAST_ENV", "development").lower() == "development"


class ItemNotFoundError(Exception):
    pass


class InsufficientCoinsError(Exception):
    pass


class AlreadyOwnedError(Exception):
    pass


class WelcomePackAlreadyClaimedError(Exception):
    pass


class GearNotOwnedError(Exception):
    pass


class GearLockedError(Exception):
    pass


def _purchase_response(player: dict) -> dict:
    return {
        "ok": True,
        "new_coins": player.get("coins", 0),
        "new_tums": player.get("antacid", 0),
        "new_xp": player.get("xp", 0),
        "owned_gear": player.get("owned_gear", []),
        "closed_beta_welcome_pack_claimed": player.get(
            "closed_beta_welcome_pack_claimed",
            False,
        ),
    }


def purchase_item(device_id: str, item_id: str) -> dict:
    before = get_or_create_player(device_id)
    item = get_shop_item(item_id)
    if not item:
        raise ItemNotFoundError

    item_type = item.get("type")
    price = int(item.get("price", 0))
    if item_type == "gear" and int(before.get("level", 1)) < int(item.get("unlock_level", 1)):
        raise GearLockedError
    if item_type in {"gear", "cosmetic"}:
        player = update_player_document(
            device_id,
            {
                "$inc": {"coins": -price},
                "$addToSet": {"owned_gear": item_id},
            },
            extra_filter={
                "coins": {"$gte": price},
                "owned_gear": {"$ne": item_id},
            },
        )
    elif item_type == "consumable":
        grant = ANTACID_GRANTS.get(item_id, 0)
        player = update_player_document(
            device_id,
            {"$inc": {"coins": -price, "antacid": grant}},
            extra_filter={"coins": {"$gte": price}},
        )
    elif item_type == "welcome_pack":
        player = update_player_document(
            device_id,
            {
                "$inc": {
                    "coins": int(item.get("coin_reward", 0)),
                    "xp": int(item.get("xp_reward", 0)),
                },
                "$set": {"closed_beta_welcome_pack_claimed": True},
            },
            extra_filter={"closed_beta_welcome_pack_claimed": {"$ne": True}},
        )
    else:
        raise ItemNotFoundError

    if player:
        if COIN_DEBUG_LOGGING:
            logger.info(
                "Coin purchase player=%s item=%s purchase_amount=%s before=%s after=%s",
                device_id,
                item_id,
                price,
                before.get("coins"),
                player.get("coins"),
            )
        return _purchase_response(player)

    current = find_player(device_id) or {}
    if (
        item_type == "welcome_pack"
        and current.get("closed_beta_welcome_pack_claimed") is True
    ):
        raise WelcomePackAlreadyClaimedError
    if item_type in {"gear", "cosmetic"} and item_id in current.get("owned_gear", []):
        raise AlreadyOwnedError
    if int(current.get("coins", 0)) < price:
        raise InsufficientCoinsError
    raise ItemNotFoundError


def purchase_gear_set(device_id: str, set_id: str) -> dict:
    set_config = GEAR_SETS.get(set_id)
    if not set_config:
        raise ItemNotFoundError
    before = get_or_create_player(device_id)
    owned = set(before.get("owned_gear", []))
    remaining = [item_id for item_id in set_config["pieces"] if item_id not in owned]
    if not remaining:
        return {**_purchase_response(before), "charged_coins": 0, "set_id": set_id, "set_complete": True}
    if any(int(before.get("level", 1)) < int(get_gear(item_id).get("unlock_level", 1)) for item_id in remaining):
        raise GearLockedError
    price = int(sum(int(get_gear(item_id)["price"]) for item_id in remaining) * (1 - float(set_config["bundle_discount"])))
    updated = update_player_document(device_id, {"$inc": {"coins": -price}, "$addToSet": {"owned_gear": {"$each": remaining}}}, extra_filter={"coins": {"$gte": price}, "$nor": [{"owned_gear": item_id} for item_id in remaining]})
    if updated:
        return {**_purchase_response(updated), "charged_coins": price, "set_id": set_id, "set_complete": True}
    current = find_player(device_id) or {}
    if all(item_id in current.get("owned_gear", []) for item_id in set_config["pieces"]):
        return {**_purchase_response(current), "charged_coins": 0, "set_id": set_id, "set_complete": True}
    if int(current.get("coins", 0)) < price:
        raise InsufficientCoinsError
    raise ItemNotFoundError


def equip_item(device_id: str, gear_id: str | None) -> dict:
    player = find_player(device_id)
    if not player:
        raise GearNotOwnedError
    if gear_id is not None and gear_id not in player.get("owned_gear", []):
        raise GearNotOwnedError
    if gear_id is not None:
        item = get_shop_item(gear_id)
        if (not item or item.get("type") != "gear") and gear_id not in LEGACY_GEAR_IDS:
            raise GearNotOwnedError

    if gear_id is None:
        updated = update_player_document(device_id, {"$set": {"equipped_gear": None, "equipped_gear_slots": {}}})
        updated["equipped_perk"] = None
        return updated
    item = get_gear(gear_id)
    if gear_id in LEGACY_GEAR_IDS:
        updated = update_player_document(device_id, {"$set": {"equipped_gear": gear_id, "equipped_gear_slots": {}}})
        updated["equipped_perk"] = gear_id
        return updated
    if not item:
        raise GearNotOwnedError
    updated = update_player_document(device_id, {"$set": {f"equipped_gear_slots.{item['slot'].lower()}": gear_id, "equipped_gear": None}})
    updated["equipped_perk"] = gear_id
    return updated


def equip_cosmetic(device_id: str, cosmetic_id: str | None) -> dict:
    """Equip one owned cosmetic without affecting gear, coins, or rewards."""
    player = find_player(device_id)
    if not player:
        raise GearNotOwnedError
    if cosmetic_id is not None:
        if cosmetic_id not in player.get("owned_gear", []):
            raise GearNotOwnedError
        item = get_shop_item(cosmetic_id)
        if not item or item.get("type") != "cosmetic":
            raise GearNotOwnedError

    return update_player_document(
        device_id,
        {"$set": {"equipped_cosmetic": cosmetic_id}},
    )
