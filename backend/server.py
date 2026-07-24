import logging
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import uuid
from database import (
    active_matches,
    database_connected,
    initialize_database,
    player_count,
    public_player_document,
    queue,
)

from services.player_service import (
    bootstrap_guest,
    find_player,
    mark_tutorial_done,
    claim_welcome_reward,
    update_player_profile,
    BootstrapAlreadyCompletedError,
    TutorialIncompleteError,
    WelcomeRewardUnavailableError,
)
from services.leaderboard_service import get_leaderboard
from services.match_service import (
    ContestNotFoundError,
    InsufficientCoinsError as MatchInsufficientCoinsError,
    MatchAlreadyActiveError,
    MatchNotFoundError,
    MatchValidationError,
    PlayerNotFoundError,
    start_match,
    submit_result,
)
from services.shop_service import (
    AlreadyOwnedError,
    GearNotOwnedError,
    InsufficientCoinsError as ShopInsufficientCoinsError,
    ItemNotFoundError,
    equip_item,
    purchase_item,
)
from models import (
    EquipRequest,
    GuestBootstrapRequest,
    MatchResult,
    MatchStart,
    PlayerCreate,
    PlayerProfileUpdate,
    PurchaseRequest,
)
from auth import authenticated_player
from rate_limit import rate_limit

from services.contest_service import featured, categories

from data.contests import CONTESTS

from data.shop import SHOP_ITEMS
from data.gear import GEAR

ENVIRONMENT = os.getenv("FIRE_FEAST_ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"
configured_origins = [
    origin.strip()
    for origin in os.getenv("FIRE_FEAST_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if IS_PRODUCTION and any(not origin.startswith("https://") for origin in configured_origins):
    raise RuntimeError("Production CORS origins must use HTTPS")
allowed_origins = configured_origins if IS_PRODUCTION else (configured_origins or ["*"])

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
purchase_limit = rate_limit("purchase", requests=30, window_seconds=60)
tutorial_limit = rate_limit("tutorial-reward", requests=10, window_seconds=60)
welcome_limit = rate_limit("welcome-reward", requests=10, window_seconds=60)


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
    initialize_database()


@app.get("/api/health")
def health():
    """Lightweight process health check for hosting platforms."""
    return {"status": "ok" if database_connected() else "degraded"}

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
        return bootstrap_guest(data.installation_id)
    except BootstrapAlreadyCompletedError:
        raise HTTPException(
            status_code=409,
            detail="guest credentials were already issued for this installation",
        )


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
            queue.remove(p)

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
    global queue
    queue = [p for p in queue if p["device_id"] != data.device_id]

    return {"status": "left"}

# =========================
# MATCH RESULT + ELO
# =========================

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
