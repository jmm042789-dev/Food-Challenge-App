"""Authoritative cosmetic equipment regression coverage."""

from copy import deepcopy
from unittest.mock import patch

import pytest
from fastapi import HTTPException

import server
from models import CosmeticEquipRequest, Player
from services import shop_service


def test_old_player_document_defaults_to_no_equipped_cosmetic():
    player = Player(device_id="guest_old", owned_gear=["gold_apron"])
    assert player.equipped_cosmetic is None


def test_owned_cosmetic_equips_persists_switches_and_costs_zero():
    persisted = {
        "device_id": "guest_cosmetic",
        "coins": 1234,
        "xp": 55,
        "owned_gear": ["gold_apron", "festival_pin"],
        "equipped_gear": "tap_boost",
    }

    def find_player(_device_id):
        return deepcopy(persisted)

    def update_player(_device_id, update, *, extra_filter=None):
        assert extra_filter is None
        assert set(update) == {"$set"}
        persisted.update(update["$set"])
        return deepcopy(persisted)

    def item(item_id):
        if item_id in {"gold_apron", "festival_pin"}:
            return {"id": item_id, "type": "cosmetic"}
        return None

    with (
        patch.object(shop_service, "find_player", side_effect=find_player),
        patch.object(shop_service, "update_player_document", side_effect=update_player),
        patch.object(shop_service, "get_shop_item", side_effect=item),
    ):
        first = shop_service.equip_cosmetic("guest_cosmetic", "gold_apron")
        assert first["equipped_cosmetic"] == "gold_apron"
        second = shop_service.equip_cosmetic("guest_cosmetic", "festival_pin")
        assert second["equipped_cosmetic"] == "festival_pin"
        cleared = shop_service.equip_cosmetic("guest_cosmetic", None)
        assert cleared["equipped_cosmetic"] is None

    assert persisted["coins"] == 1234
    assert persisted["xp"] == 55
    assert persisted["equipped_gear"] == "tap_boost"


def test_unowned_or_non_cosmetic_item_cannot_equip():
    player = {"device_id": "guest_cosmetic", "owned_gear": ["gold_apron", "tap_boost"]}
    with patch.object(shop_service, "find_player", return_value=player):
        with pytest.raises(shop_service.GearNotOwnedError):
            shop_service.equip_cosmetic("guest_cosmetic", "not_owned")
        with pytest.raises(shop_service.GearNotOwnedError):
            shop_service.equip_cosmetic("guest_cosmetic", "tap_boost")


def test_cosmetic_endpoint_requires_authenticated_owner():
    request = CosmeticEquipRequest(device_id="guest_cosmetic", cosmetic_id="gold_apron")
    with (
        patch.object(server, "authenticated_player", side_effect=HTTPException(status_code=401, detail="invalid or missing authentication credentials")),
        patch.object(server, "equip_cosmetic") as equip,
        pytest.raises(HTTPException) as raised,
    ):
        server.equip_cosmetic_endpoint(request, "Bearer wrong")
    assert raised.value.status_code == 401
    equip.assert_not_called()


def test_authenticated_cosmetic_endpoint_uses_requested_owner():
    request = CosmeticEquipRequest(device_id="guest_cosmetic", cosmetic_id="gold_apron")
    authoritative = {"device_id": "guest_cosmetic", "equipped_cosmetic": "gold_apron", "coins": 500}
    with (
        patch.object(server, "authenticated_player") as authenticate,
        patch.object(server, "equip_cosmetic", return_value=authoritative) as equip,
    ):
        response = server.equip_cosmetic_endpoint(request, "Bearer valid")
    authenticate.assert_called_once_with("guest_cosmetic", "Bearer valid")
    equip.assert_called_once_with("guest_cosmetic", "gold_apron")
    assert response == authoritative

