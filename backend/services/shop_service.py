"""Atomic Fire Feast purchase and equipment operations."""

from data.shop import get_shop_item
from database import update_player_document
from services.player_service import find_player, get_or_create_player


ANTACID_GRANTS = {"antacid_pack": 5}


class ItemNotFoundError(Exception):
    pass


class InsufficientCoinsError(Exception):
    pass


class AlreadyOwnedError(Exception):
    pass


class GearNotOwnedError(Exception):
    pass


def _purchase_response(player: dict) -> dict:
    return {
        "ok": True,
        "new_coins": player.get("coins", 0),
        "new_tums": player.get("antacid", 0),
        "owned_gear": player.get("owned_gear", []),
    }


def purchase_item(device_id: str, item_id: str) -> dict:
    get_or_create_player(device_id)
    item = get_shop_item(item_id)
    if not item:
        raise ItemNotFoundError

    item_type = item.get("type")
    price = int(item.get("price", 0))
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
    elif item_type == "currency":
        player = update_player_document(
            device_id,
            {"$inc": {"coins": int(item.get("reward", 0))}},
        )
    else:
        raise ItemNotFoundError

    if player:
        return _purchase_response(player)

    current = find_player(device_id) or {}
    if item_type in {"gear", "cosmetic"} and item_id in current.get("owned_gear", []):
        raise AlreadyOwnedError
    if int(current.get("coins", 0)) < price:
        raise InsufficientCoinsError
    raise ItemNotFoundError


def equip_item(device_id: str, gear_id: str | None) -> dict:
    player = find_player(device_id)
    if not player:
        raise GearNotOwnedError
    if gear_id is not None and gear_id not in player.get("owned_gear", []):
        raise GearNotOwnedError

    updated = update_player_document(
        device_id,
        {"$set": {"equipped_gear": gear_id}},
    )
    updated["equipped_perk"] = gear_id
    return updated
