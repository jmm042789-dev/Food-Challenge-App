import logging

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import uuid
from database import (
    active_matches,
    close_database,
    database_connected,
    database_readiness,
    delete_guest_player,
    initialize_database,
    player_count,
    public_player_document,
    queue,
)
from config import ConfigurationError, load_config

from services.player_service import (
    bootstrap_guest,
    finish_guest_bootstrap,
    recover_guest_bootstrap,
    find_player,
    mark_tutorial_done,
    claim_welcome_reward,
    update_player_profile,
    BootstrapAlreadyCompletedError,
    BootstrapRecoveryError,
    TutorialIncompleteError,
    WelcomeRewardUnavailableError,
)
from services.leaderboard_service import get_leaderboard
from services.daily_reward_service import (
    DailySpinUnavailableError,
    claim_daily_spin,
    daily_spin_status,
)
from services.match_service import (
    ContestNotFoundError,
    InsufficientCoinsError as MatchInsufficientCoinsError,
    MatchAlreadyActiveError,
    MatchExpiredError,
    MatchNotFoundError,
    MatchValidationError,
    PlayerNotFoundError,
    cancel_match,
    cleanup_stale_matchmaking_state,
    expire_stale_match,
    recover_match,
    start_match,
    submit_result,
)
from services.shop_service import (
    AlreadyOwnedError,
    GearNotOwnedError,
    InsufficientCoinsError as ShopInsufficientCoinsError,
    ItemNotFoundError,
    WelcomePackAlreadyClaimedError,
    equip_item,
    purchase_item,
)
from models import (
    EquipRequest,
    AccountDeletionRequest,
    GuestBootstrapRequest,
    GuestRecoveryRequest,
    MatchResult,
    MatchStart,
    PlayerCreate,
    PlayerProfileUpdate,
    PurchaseRequest,
)
from auth import authenticated_bearer_player, authenticated_player
from rate_limit import rate_limit

from services.contest_service import featured, categories

from data.contests import CONTESTS

from data.shop import SHOP_ITEMS
from data.gear import GEAR

app_config = load_config(require_database=False)
IS_PRODUCTION = app_config.is_production
allowed_origins = (
    list(app_config.cors_origins)
    if app_config.cors_origins
    else ([] if IS_PRODUCTION else ["*"])
)

app = FastAPI(
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)

MAX_REQUEST_BYTES = 16 * 1024

bootstrap_limit = rate_limit("guest-bootstrap", requests=10, window_seconds=60)
matchmaking_join_limit = rate_limit("matchmaking-join", requests=30, window_seconds=60)
match_start_limit = rate_limit("match-start", requests=20, window_seconds=60)
match_result_limit = rate_limit("match-result", requests=30, window_seconds=60)
match_recovery_limit = rate_limit("match-recovery", requests=60, window_seconds=60)
match_abandon_limit = rate_limit("match-abandon", requests=10, window_seconds=60)
purchase_limit = rate_limit("purchase", requests=30, window_seconds=60)
tutorial_limit = rate_limit("tutorial-reward", requests=10, window_seconds=60)
welcome_limit = rate_limit("welcome-reward", requests=10, window_seconds=60)
daily_spin_limit = rate_limit("daily-spin", requests=10, window_seconds=60)
account_deletion_limit = rate_limit(
    "account-deletion",
    requests=3,
    window_seconds=60 * 60,
)


@app.middleware("http")
async def reject_oversized_requests(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            parsed_length = int(content_length)
            if parsed_length < 0:
                return JSONResponse(status_code=400, content={"detail": "invalid request"})
            if parsed_length > MAX_REQUEST_BYTES:
                return JSONResponse(status_code=413, content={"detail": "request too large"})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "invalid request"})
    return await call_next(request)


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, error: Exception):
    logger.error("Unhandled API error (%s)", type(error).__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "internal server error"},
    )


def require_diagnostics():
    if IS_PRODUCTION:
        raise HTTPException(status_code=404, detail="not found")


@app.on_event("startup")
def startup_database():
    try:
        validated_config = load_config()
    except ConfigurationError as error:
        logger.critical("Configuration validation failed: %s", error)
        raise RuntimeError("backend configuration is invalid") from None

    try:
        initialize_database(validated_config)
    except Exception as error:
        logger.critical(
            "Database startup validation failed (%s)",
            type(error).__name__,
        )
        close_database()
        raise RuntimeError("database startup validation failed") from None
    logger.info(
        "Backend startup complete (environment=%s)",
        validated_config.environment,
    )


@app.on_event("shutdown")
def shutdown_database():
    close_database()
    logger.info("Backend shutdown complete")


def _readiness_response(endpoint_name: str, *, compatibility: bool = False):
    result = database_readiness()
    if result.ready:
        return {"status": "ok" if compatibility else "ready"}
    logger.warning(
        "Health endpoint failure (endpoint=%s category=%s exception=%s)",
        endpoint_name,
        result.category,
        result.exception_type or "none",
    )
    return JSONResponse(status_code=503, content={"status": "unavailable"})


@app.get("/api/health/live")
def health_live():
    """Process liveness only; intentionally independent of MongoDB."""
    return {"status": "alive", "service": "fire-feast-api"}


@app.get("/api/health/ready")
def health_ready():
    """Report whether required dependencies can serve application traffic."""
    return _readiness_response("/api/health/ready")


@app.get("/api/health")
def health():
    """Compatibility health endpoint with readiness semantics."""
    return _readiness_response("/api/health", compatibility=True)

# =========================
# DATABASE
# =========================



# =========================
# ROOT TEST
# =========================

@app.get("/api/")
def root():
    require_diagnostics()
    return {
        "ok": True,
        "message": "Backend is working 🚀",
        "mongo_connected": database_connected()
    }

@app.get("/api/test")
def test():
    require_diagnostics()
    return {"ok": True}

# =========================
# PLAYER SYSTEM
# =========================

@app.post("/api/auth/guest", dependencies=[Depends(bootstrap_limit)])
def guest_bootstrap_endpoint(data: GuestBootstrapRequest):
    try:
        return bootstrap_guest(
            data.installation_id,
            data.recovery_nonce,
            recovery_window_seconds=app_config.guest_recovery_window_seconds,
        )
    except BootstrapAlreadyCompletedError:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "GUEST_BOOTSTRAP_EXISTS",
                "message": "Guest credentials were already issued for this installation.",
            },
        )


@app.post("/api/auth/guest/recover", dependencies=[Depends(bootstrap_limit)])
def guest_recovery_endpoint(data: GuestRecoveryRequest):
    try:
        return recover_guest_bootstrap(
            data.installation_id,
            data.recovery_nonce,
            data.new_auth_token,
        )
    except BootstrapRecoveryError as error:
        raise HTTPException(
            status_code=409,
            detail={"code": error.code, "message": error.message},
        )


@app.post("/api/auth/guest/complete")
def guest_bootstrap_complete_endpoint(
    authorization: str | None = Header(default=None),
):
    player = authenticated_bearer_player(authorization)
    return finish_guest_bootstrap(player)


@app.get("/api/auth/session")
def guest_session_endpoint(
    authorization: str | None = Header(default=None),
):
    """Resolve a valid opaque bearer token to its authoritative guest ID."""
    player = authenticated_bearer_player(authorization)
    player_id = player.get("player_id") or player["device_id"]
    return {
        "player_id": player_id,
        "player": public_player_document(player),
        "token_type": "opaque",
        "token_version": player.get("token_version"),
    }


@app.post("/api/player")
def create_player_endpoint(
    data: PlayerCreate,
    authorization: str | None = Header(default=None),
):
    player = authenticated_player(data.device_id, authorization)
    return public_player_document(player)


@app.post("/api/player/tutorial_done", dependencies=[Depends(tutorial_limit)])
def tutorial_done_endpoint(
    data: PlayerCreate,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    player = mark_tutorial_done(data.device_id)

    if not player:
        raise HTTPException(status_code=404, detail="player not found")

    return player


@app.post("/api/player/welcome_reward", dependencies=[Depends(welcome_limit)])
def welcome_reward_endpoint(
    data: PlayerCreate,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        result = claim_welcome_reward(data.device_id)
    except TutorialIncompleteError:
        raise HTTPException(status_code=409, detail="tutorial must be completed first")
    except WelcomeRewardUnavailableError:
        raise HTTPException(status_code=409, detail="welcome reward is not available for this player")

    if not result:
        raise HTTPException(status_code=404, detail="player not found")

    return result


@app.get("/api/player/{device_id}")
def get_player_endpoint(
    device_id: str,
    authorization: str | None = Header(default=None),
):
    player = authenticated_player(device_id, authorization)
    return public_player_document(player)


@app.get("/api/daily/status/{device_id}")
def daily_spin_status_endpoint(
    device_id: str,
    authorization: str | None = Header(default=None),
):
    authenticated_player(device_id, authorization)
    status = daily_spin_status(device_id)
    if not status:
        raise HTTPException(status_code=404, detail="player not found")
    return status


@app.post("/api/daily/claim", dependencies=[Depends(daily_spin_limit)])
def daily_spin_claim_endpoint(
    data: PlayerCreate,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        result = claim_daily_spin(data.device_id)
    except DailySpinUnavailableError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "daily spin is not available yet",
                "next_daily_spin": error.next_daily_spin,
            },
        )
    if not result:
        raise HTTPException(status_code=404, detail="player not found")
    return result


@app.patch("/api/player/{device_id}")
def update_player_endpoint(
    device_id: str,
    data: PlayerProfileUpdate,
    authorization: str | None = Header(default=None),
):
    authenticated_player(device_id, authorization)
    player = update_player_profile(device_id, data.model_dump(exclude_none=True))
    if not player:
        raise HTTPException(status_code=404, detail="player not found")
    return player


@app.delete(
    "/api/player/account",
    dependencies=[Depends(account_deletion_limit)],
)
def delete_player_account_endpoint(
    data: AccountDeletionRequest,
    authorization: str | None = Header(default=None),
):
    """Permanently remove only the guest identified by the bearer credential."""
    player = authenticated_bearer_player(authorization)
    delete_guest_player(player["device_id"], player["auth_token_hash"])
    return {"deleted": True}

# =========================
# MATCHMAKING
# =========================

@app.post("/api/matchmaking/join", dependencies=[Depends(matchmaking_join_limit)])
def join_queue(
    data: PlayerCreate,
    authorization: str | None = Header(default=None),
):
    device_id = data.device_id
    player = authenticated_player(device_id, authorization)
    cleanup_stale_matchmaking_state()
    expire_stale_match(device_id)
    if recover_match(device_id)["status"] == "resumable":
        raise HTTPException(status_code=409, detail="an active match requires recovery")

    # prevent duplicates
    for p in queue:
        if p["device_id"] == device_id:
            return {"status": "waiting"}

    queue.append({
        "device_id": device_id,
        "elo": player["elo"],
        "time": time.time()
    })

    # try match
    for p in queue:
        if p["device_id"] == device_id:
            continue

        if abs(p["elo"] - player["elo"]) <= 200:
            queue[:] = [
                entry
                for entry in queue
                if entry["device_id"] not in {device_id, p["device_id"]}
            ]

            match_id = str(uuid.uuid4())

            active_matches[match_id] = {
                "players": [device_id, p["device_id"]],
                "created": time.time()
            }

            return {
                "status": "matched",
                "match_id": match_id,
                "opponent": p["device_id"]
            }

    return {"status": "waiting"}


@app.get("/api/matchmaking/status/{device_id}")
def matchmaking_status(
    device_id: str,
    authorization: str | None = Header(default=None),
):
    authenticated_player(device_id, authorization)
    cleanup_stale_matchmaking_state()
    expire_stale_match(device_id)
    for match_id, match in active_matches.items():
        if device_id in match["players"]:
            return {
                "status": "matched",
                "match_id": match_id,
                "players": match["players"]
            }

    return {"status": "searching"}


@app.post("/api/matchmaking/leave")
def leave_queue(
    data: PlayerCreate,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    queue[:] = [p for p in queue if p["device_id"] != data.device_id]

    return {"status": "left"}

# =========================
# MATCH RESULT + ELO
# =========================

@app.get("/api/match/active", dependencies=[Depends(match_recovery_limit)])
def active_match_endpoint(
    authorization: str | None = Header(default=None),
):
    player = authenticated_bearer_player(authorization)
    return recover_match(player["device_id"])


@app.post("/api/match/abandon", dependencies=[Depends(match_abandon_limit)])
def abandon_match_endpoint(
    authorization: str | None = Header(default=None),
):
    player = authenticated_bearer_player(authorization)
    try:
        return cancel_match(player["device_id"])
    except PlayerNotFoundError:
        raise HTTPException(status_code=401, detail="invalid or missing authentication credentials")
    except MatchValidationError:
        raise HTTPException(status_code=409, detail="match cannot be cancelled")

@app.post("/api/match/start", dependencies=[Depends(match_start_limit)])
def match_start_endpoint(
    data: MatchStart,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        return start_match(data.device_id, data.contest_id)
    except PlayerNotFoundError:
        raise HTTPException(status_code=404, detail="player not found")
    except ContestNotFoundError:
        raise HTTPException(status_code=404, detail="contest not found")
    except MatchInsufficientCoinsError:
        raise HTTPException(status_code=400, detail="not enough coins")
    except MatchAlreadyActiveError:
        raise HTTPException(status_code=409, detail="another match is already active")


@app.post("/api/match/result", dependencies=[Depends(match_result_limit)])
def match_result(
    data: MatchResult,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        return submit_result(data)
    except PlayerNotFoundError:
        raise HTTPException(status_code=404, detail="player not found")
    except MatchNotFoundError:
        raise HTTPException(status_code=409, detail="no matching active match")
    except MatchExpiredError:
        raise HTTPException(status_code=409, detail="match has expired")
    except MatchValidationError:
        raise HTTPException(status_code=400, detail="match result does not match the active match")

# =========================
# SHOP / GEAR
# =========================

@app.get("/api/shop")
def shop():
    return {"items": SHOP_ITEMS}


@app.get("/api/gear")
def gear():
    return {"items": GEAR}


@app.post("/api/purchase", dependencies=[Depends(purchase_limit)])
def purchase_endpoint(
    data: PurchaseRequest,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        return purchase_item(data.device_id, data.item_id)
    except ItemNotFoundError:
        raise HTTPException(status_code=404, detail="item not found")
    except ShopInsufficientCoinsError:
        raise HTTPException(status_code=400, detail="not enough coins")
    except AlreadyOwnedError:
        raise HTTPException(status_code=400, detail="item already owned")
    except WelcomePackAlreadyClaimedError:
        raise HTTPException(status_code=409, detail="welcome pack already redeemed")


@app.post("/api/player/equip")
def equip_endpoint(
    data: EquipRequest,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        return equip_item(data.device_id, data.gear_id)
    except GearNotOwnedError:
        raise HTTPException(status_code=400, detail="you do not own that gear")


@app.get("/api/leaderboard")
def leaderboard_endpoint():
    return get_leaderboard()

# =========================
# DEBUG
# =========================

@app.get("/api/debug-db")
def debug():
    require_diagnostics()
    return {
        "players": player_count(),
        "queue": len(queue),
        "matches": len(active_matches)
    }

# =========================
# CONTEST ROUTES
# =========================

@app.get("/api/contests")
def contests():
    """Return the local contest catalog without any external dependencies."""
    try:
        return {"contests": CONTESTS}
    except Exception as exc:
        logger.exception("Unable to load the contest catalog")
        raise HTTPException(
            status_code=500,
            detail="Unable to load the contest catalog",
        ) from exc


@app.get("/api/featured-contest")
def get_featured_contest():
    return {"contest": featured()}


@app.get("/api/contest-categories")
def get_categories():
    return {"categories": categories()}
