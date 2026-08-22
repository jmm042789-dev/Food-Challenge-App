import logging
from time import perf_counter

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
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
from services.leaderboard_service import contest_catalog, get_contest_leaderboard, get_leaderboard
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
    equip_cosmetic,
    equip_item,
    purchase_item,
)
from models import (
    CosmeticEquipRequest,
    EquipRequest,
    AccountDeletionRequest,
    GuestBootstrapRequest,
    GuestRecoveryRequest,
    MatchResult,
    MatchStart,
    PvpAttemptResult,
    PvpAttemptStart,
    PvpChallengeAction,
    PvpChallengeCreate,
    PvpQuipSend,
    PvpRematchRequest,
    PlayerCreate,
    PlayerProfileUpdate,
    SocialPlayerAction,
    SocialProfileUpdate,
    PurchaseRequest,
)
from auth import authenticated_bearer_player, authenticated_player
from rate_limit import rate_limit
from services.social_service import (
    SocialError,
    accept_request,
    cancel_request,
    decline_request,
    get_profile as get_social_profile,
    handle_availability,
    list_relationships,
    own_public_profile,
    remove_friend,
    search as search_social_players,
    send_request,
    update_profile as update_social_profile,
)
from services.pvp_service import (
    PvpError,
    accept_challenge,
    active_match as active_pvp_match,
    compatible_contests as pvp_compatible_contests,
    create_challenge,
    create_rematch,
    get_match as get_pvp_match,
    list_challenges,
    recent_opponents,
    rivalry_record,
    send_quip,
    start_attempt,
    submit_attempt,
    transition_challenge,
)
from observability import (
    REQUEST_ID_HEADER,
    request_id_for,
    request_id_from,
    response_outcome,
    safe_request_route,
)

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
    expose_headers=[REQUEST_ID_HEADER],
)
logger = logging.getLogger(__name__)

MAX_REQUEST_BYTES = 16 * 1024
MAX_MATCH_RESULT_REQUEST_BYTES = 384 * 1024

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
social_search_limit = rate_limit("social-search", requests=30, window_seconds=60)
social_request_limit = rate_limit("social-request", requests=20, window_seconds=60)
social_action_limit = rate_limit("social-action", requests=40, window_seconds=60)
social_profile_limit = rate_limit("social-profile", requests=12, window_seconds=60)
pvp_challenge_limit = rate_limit("pvp-challenge", requests=12, window_seconds=60)
pvp_action_limit = rate_limit("pvp-action", requests=30, window_seconds=60)
pvp_status_limit = rate_limit("pvp-status", requests=90, window_seconds=60)
pvp_start_limit = rate_limit("pvp-start", requests=12, window_seconds=60)
pvp_result_limit = rate_limit("pvp-result", requests=20, window_seconds=60)
pvp_rematch_limit = rate_limit("pvp-rematch", requests=8, window_seconds=60)
pvp_quip_limit = rate_limit("pvp-quip", requests=20, window_seconds=60)
leaderboard_limit = rate_limit("leaderboard-read", requests=90, window_seconds=60)


def social_error(error: SocialError):
    raise HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": "The social request could not be completed."},
    )


def pvp_error(error: PvpError):
    raise HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": "The PvP request could not be completed."},
    )


@app.middleware("http")
async def reject_oversized_requests(request: Request, call_next):
    request_limit = (
        MAX_MATCH_RESULT_REQUEST_BYTES
        if request.url.path in {"/api/match/result", "/api/pvp/result"}
        else MAX_REQUEST_BYTES
    )
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            parsed_length = int(content_length)
            if parsed_length < 0:
                return JSONResponse(status_code=400, content={"detail": "invalid request"})
            if parsed_length > request_limit:
                return JSONResponse(status_code=413, content={"detail": "request too large"})
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "invalid request"})
    chunks = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > request_limit:
            return JSONResponse(status_code=413, content={"detail": "request too large"})
        chunks.append(chunk)
    # Starlette reuses this bounded cached body for downstream model parsing.
    request._body = b"".join(chunks)
    return await call_next(request)


@app.middleware("http")
async def observe_request(request: Request, call_next):
    request_id = request_id_for(request.headers.get(REQUEST_ID_HEADER))
    request.state.request_id = request_id
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception as error:
        response = await unexpected_error_handler(request, error)

    response.headers[REQUEST_ID_HEADER] = request_id
    duration_ms = (perf_counter() - started) * 1000
    route = safe_request_route(request)
    log = logger.debug if route.startswith("/api/health") else logger.info
    log(
        "Request complete request_id=%s method=%s route=%s status=%s duration_ms=%.2f outcome=%s",
        request_id,
        request.method,
        route,
        response.status_code,
        duration_ms,
        response_outcome(response.status_code),
    )
    return response


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, error: Exception):
    request_id = request_id_from(request)
    logger.error(
        "Request failure request_id=%s method=%s route=%s category=unexpected_error exception=%s",
        request_id,
        request.method,
        safe_request_route(request),
        type(error).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "internal server error"},
        headers={REQUEST_ID_HEADER: request_id},
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


def _readiness_response(
    endpoint_name: str,
    request: Request | None = None,
    *,
    compatibility: bool = False,
):
    result = database_readiness()
    if result.ready:
        return {"status": "ok" if compatibility else "ready"}
    logger.warning(
        "Health endpoint failure request_id=%s endpoint=%s category=%s exception=%s",
        request_id_from(request) if request is not None else "unavailable",
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
def health_ready(request: Request):
    """Report whether required dependencies can serve application traffic."""
    return _readiness_response("/api/health/ready", request)


@app.get("/api/health")
def health(request: Request):
    """Compatibility health endpoint with readiness semantics."""
    return _readiness_response("/api/health", request, compatibility=True)

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


@app.get("/api/social/me")
def own_social_profile_endpoint(authorization: str | None = Header(default=None)):
    try:
        return own_public_profile(authenticated_bearer_player(authorization))
    except SocialError as error:
        social_error(error)


@app.patch("/api/social/me", dependencies=[Depends(social_profile_limit)])
def update_social_profile_endpoint(
    data: SocialProfileUpdate,
    authorization: str | None = Header(default=None),
):
    try:
        return update_social_profile(
            authenticated_bearer_player(authorization),
            data.handle,
            data.display_name,
            data.avatar,
        )
    except SocialError as error:
        social_error(error)


@app.get("/api/social/search", dependencies=[Depends(social_search_limit)])
def social_search_endpoint(
    q: str = Query(min_length=3, max_length=20),
    authorization: str | None = Header(default=None),
):
    try:
        return {"players": search_social_players(authenticated_bearer_player(authorization), q)}
    except SocialError as error:
        social_error(error)


@app.get("/api/social/handle/availability", dependencies=[Depends(social_search_limit)])
def social_handle_availability_endpoint(
    q: str = Query(min_length=3, max_length=20),
    authorization: str | None = Header(default=None),
):
    try:
        return handle_availability(authenticated_bearer_player(authorization), q)
    except SocialError as error:
        social_error(error)


@app.get("/api/social/players/{public_id}")
def social_profile_endpoint(
    public_id: str,
    authorization: str | None = Header(default=None),
):
    try:
        return get_social_profile(authenticated_bearer_player(authorization), public_id)
    except SocialError as error:
        social_error(error)


@app.get("/api/social/friends")
def social_friends_endpoint(authorization: str | None = Header(default=None)):
    try:
        return list_relationships(authenticated_bearer_player(authorization))
    except SocialError as error:
        social_error(error)


@app.post("/api/social/friends/request", dependencies=[Depends(social_request_limit)])
def social_send_request_endpoint(data: SocialPlayerAction, authorization: str | None = Header(default=None)):
    try:
        return send_request(authenticated_bearer_player(authorization), data.public_id)
    except SocialError as error:
        social_error(error)


@app.post("/api/social/friends/accept", dependencies=[Depends(social_action_limit)])
def social_accept_endpoint(data: SocialPlayerAction, authorization: str | None = Header(default=None)):
    try:
        return accept_request(authenticated_bearer_player(authorization), data.public_id)
    except SocialError as error:
        social_error(error)


@app.post("/api/social/friends/decline", dependencies=[Depends(social_action_limit)])
def social_decline_endpoint(data: SocialPlayerAction, authorization: str | None = Header(default=None)):
    try:
        return decline_request(authenticated_bearer_player(authorization), data.public_id)
    except SocialError as error:
        social_error(error)


@app.post("/api/social/friends/cancel", dependencies=[Depends(social_action_limit)])
def social_cancel_endpoint(data: SocialPlayerAction, authorization: str | None = Header(default=None)):
    try:
        return cancel_request(authenticated_bearer_player(authorization), data.public_id)
    except SocialError as error:
        social_error(error)


@app.post("/api/social/friends/remove", dependencies=[Depends(social_action_limit)])
def social_remove_endpoint(data: SocialPlayerAction, authorization: str | None = Header(default=None)):
    try:
        return remove_friend(authenticated_bearer_player(authorization), data.public_id)
    except SocialError as error:
        social_error(error)


@app.get("/api/pvp/contests")
def pvp_contests_endpoint(authorization: str | None = Header(default=None)):
    authenticated_bearer_player(authorization)
    return {"contests": pvp_compatible_contests()}


@app.get("/api/pvp/challenges", dependencies=[Depends(pvp_status_limit)])
def pvp_challenges_endpoint(authorization: str | None = Header(default=None)):
    try:
        return list_challenges(authenticated_bearer_player(authorization))
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/challenges", dependencies=[Depends(pvp_challenge_limit)])
def pvp_create_challenge_endpoint(data: PvpChallengeCreate, authorization: str | None = Header(default=None)):
    try:
        return create_challenge(authenticated_bearer_player(authorization), data.recipient_public_id, data.contest_id)
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/challenges/accept", dependencies=[Depends(pvp_action_limit)])
def pvp_accept_challenge_endpoint(data: PvpChallengeAction, authorization: str | None = Header(default=None)):
    try:
        return accept_challenge(authenticated_bearer_player(authorization), data.challenge_id)
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/challenges/decline", dependencies=[Depends(pvp_action_limit)])
def pvp_decline_challenge_endpoint(data: PvpChallengeAction, authorization: str | None = Header(default=None)):
    try:
        return transition_challenge(authenticated_bearer_player(authorization), data.challenge_id, "DECLINED")
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/challenges/cancel", dependencies=[Depends(pvp_action_limit)])
def pvp_cancel_challenge_endpoint(data: PvpChallengeAction, authorization: str | None = Header(default=None)):
    try:
        return transition_challenge(authenticated_bearer_player(authorization), data.challenge_id, "CANCELLED")
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/rematch", dependencies=[Depends(pvp_rematch_limit)])
def pvp_rematch_endpoint(data: PvpRematchRequest, authorization: str | None = Header(default=None)):
    try:
        return create_rematch(authenticated_bearer_player(authorization), data.match_id)
    except PvpError as error:
        pvp_error(error)


@app.get("/api/pvp/rivalry/{opponent_public_id}", dependencies=[Depends(pvp_status_limit)])
def pvp_rivalry_endpoint(opponent_public_id: str, authorization: str | None = Header(default=None)):
    try:
        return rivalry_record(authenticated_bearer_player(authorization), opponent_public_id)
    except PvpError as error:
        pvp_error(error)


@app.get("/api/pvp/recent", dependencies=[Depends(pvp_status_limit)])
def pvp_recent_endpoint(authorization: str | None = Header(default=None)):
    try:
        return recent_opponents(authenticated_bearer_player(authorization))
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/quips", dependencies=[Depends(pvp_quip_limit)])
def pvp_quip_endpoint(data: PvpQuipSend, authorization: str | None = Header(default=None)):
    try:
        return send_quip(authenticated_bearer_player(authorization), data)
    except PvpError as error:
        pvp_error(error)


@app.get("/api/pvp/matches/active", dependencies=[Depends(pvp_status_limit)])
def pvp_active_match_endpoint(authorization: str | None = Header(default=None)):
    try:
        return active_pvp_match(authenticated_bearer_player(authorization))
    except PvpError as error:
        pvp_error(error)


@app.get("/api/pvp/matches/{match_id}", dependencies=[Depends(pvp_status_limit)])
def pvp_match_status_endpoint(match_id: str, authorization: str | None = Header(default=None)):
    try:
        return get_pvp_match(authenticated_bearer_player(authorization), match_id)
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/attempt/start", dependencies=[Depends(pvp_start_limit)])
def pvp_start_attempt_endpoint(data: PvpAttemptStart, authorization: str | None = Header(default=None)):
    try:
        return start_attempt(authenticated_bearer_player(authorization), data.match_id)
    except PvpError as error:
        pvp_error(error)


@app.post("/api/pvp/result", dependencies=[Depends(pvp_result_limit)])
def pvp_result_endpoint(data: PvpAttemptResult, authorization: str | None = Header(default=None)):
    try:
        return submit_attempt(authenticated_bearer_player(authorization), data)
    except PvpError as error:
        pvp_error(error)


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
        raise HTTPException(status_code=404, detail={"code": "MATCH_PLAYER_NOT_FOUND", "message": "player not found"})
    except MatchNotFoundError:
        raise HTTPException(status_code=409, detail={"code": "MATCH_NOT_ACTIVE", "message": "no matching active match"})
    except MatchExpiredError:
        raise HTTPException(status_code=409, detail={"code": "MATCH_EXPIRED", "message": "match has expired"})
    except MatchValidationError:
        raise HTTPException(status_code=400, detail={"code": "MATCH_RESULT_REJECTED", "message": "match result could not be verified"})

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


@app.post("/api/player/equip-cosmetic")
def equip_cosmetic_endpoint(
    data: CosmeticEquipRequest,
    authorization: str | None = Header(default=None),
):
    authenticated_player(data.device_id, authorization)
    try:
        return equip_cosmetic(data.device_id, data.cosmetic_id)
    except GearNotOwnedError:
        raise HTTPException(status_code=400, detail="you do not own that cosmetic")


@app.get("/api/leaderboard", dependencies=[Depends(leaderboard_limit)])
def leaderboard_endpoint(authorization: str | None = Header(default=None)):
    return get_leaderboard(authenticated_bearer_player(authorization))


@app.get("/api/leaderboard/contests", dependencies=[Depends(leaderboard_limit)])
def leaderboard_contests_endpoint(authorization: str | None = Header(default=None)):
    return contest_catalog(authenticated_bearer_player(authorization))


@app.get("/api/leaderboard/contest/{contest_id}", dependencies=[Depends(leaderboard_limit)])
def contest_leaderboard_endpoint(contest_id: str, authorization: str | None = Header(default=None)):
    try:
        return get_contest_leaderboard(authenticated_bearer_player(authorization), contest_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="contest leaderboard not found")
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
def contests(request: Request):
    """Return the local contest catalog without any external dependencies."""
    try:
        return {"contests": CONTESTS}
    except Exception as exc:
        logger.error(
            "Contest catalog failure request_id=%s exception=%s",
            request_id_from(request),
            type(exc).__name__,
        )
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
