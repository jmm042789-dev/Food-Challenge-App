"""Authenticated, resumable, one-use promotion redemption."""

from datetime import datetime, timezone
import hashlib
import re
import uuid

from data.promotions import CRUISE_DUCK_CAMPAIGN, CRUISE_DUCK_ENABLED, CRUISE_DUCK_REWARD_COINS
from database import claim_promotion_code, create_or_get_promotion_redemption, discard_pending_promotion_redemption, finalize_promotion_code, finalize_promotion_redemption, find_internal_player, find_promotion_code, promotion_redemption_for_player, update_player_document

CODE_PATTERN = re.compile(r"^[A-Z0-9-]{12,40}$")

class PromotionError(Exception):
    def __init__(self, code: str, status_code: int = 400):
        super().__init__(code); self.code = code; self.status_code = status_code

def hash_promotion_code(code: str) -> str:
    normalized = "".join(code.strip().upper().split())
    if not CODE_PATTERN.fullmatch(normalized):
        raise PromotionError("PROMO_INVALID", 404)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def _response(player: dict, redemption: dict, status: str) -> dict:
    return {"status": status, "campaign": CRUISE_DUCK_CAMPAIGN, "duck_number": redemption["duck_number"], "reward": {"type": "coins", "value": CRUISE_DUCK_REWARD_COINS}, "new_coins": int(player.get("coins", 0))}

def redeem_cruise_duck(player: dict, raw_code: str) -> dict:
    if not CRUISE_DUCK_ENABLED: raise PromotionError("PROMO_DISABLED", 409)
    code_hash = hash_promotion_code(raw_code)
    code = find_promotion_code(CRUISE_DUCK_CAMPAIGN, code_hash)
    if not code: raise PromotionError("PROMO_INVALID", 404)
    device_id = player["device_id"]
    prior = promotion_redemption_for_player(CRUISE_DUCK_CAMPAIGN, device_id)
    if prior and prior.get("code_hash") != code_hash: raise PromotionError("PROMO_PLAYER_LIMIT", 409)
    redemption_id = prior.get("redemption_id") if prior else f"pr_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    redemption = create_or_get_promotion_redemption({"redemption_id": redemption_id, "campaign": CRUISE_DUCK_CAMPAIGN, "player_device_id": device_id, "code_hash": code_hash, "duck_number": code["duck_number"], "status": "PENDING", "created_at": now})
    if redemption.get("code_hash") != code_hash: raise PromotionError("PROMO_PLAYER_LIMIT", 409)
    redemption_id = redemption["redemption_id"]
    if redemption.get("status") == "REDEEMED":
        current = find_internal_player(device_id)
        if not current: raise PromotionError("PROMO_AUTH_REQUIRED", 401)
        return _response(current, redemption, "ALREADY_REDEEMED")
    claimed = claim_promotion_code(CRUISE_DUCK_CAMPAIGN, code_hash, redemption_id, device_id, now)
    if not claimed:
        discard_pending_promotion_redemption(redemption_id)
        raise PromotionError("PROMO_ALREADY_REDEEMED", 409)
    updated = update_player_document(device_id, {"$inc": {"coins": CRUISE_DUCK_REWARD_COINS}, "$addToSet": {"promotion_redemptions": CRUISE_DUCK_CAMPAIGN}}, extra_filter={"promotion_redemptions": {"$ne": CRUISE_DUCK_CAMPAIGN}})
    already_granted = updated is None
    if updated is None:
        updated = find_internal_player(device_id)
        if not updated or CRUISE_DUCK_CAMPAIGN not in updated.get("promotion_redemptions", []): raise PromotionError("PROMO_AUTH_REQUIRED", 401)
    finalize_promotion_redemption(redemption_id, now)
    finalize_promotion_code(code_hash, redemption_id, now)
    redemption["status"] = "REDEEMED"
    return _response(updated, redemption, "ALREADY_REDEEMED" if already_granted else "REDEEMED")
